import { ShotPoint, TargetMode } from '../types/target';
import { calculateShotScore } from './issfSpecs';
import { processTargetImage, VisionProcessResult } from './visionProcessor';
import { fuseGeminiCandidates } from './geminiFusion';

const GEMINI_API_STORAGE_KEY = 'targetscan_gemini_api_key';
export function getStoredGeminiApiKey(): string {
  try { return localStorage.getItem(GEMINI_API_STORAGE_KEY) || ''; } catch { return ''; }
}
export function setStoredGeminiApiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(GEMINI_API_STORAGE_KEY, key.trim());
    else localStorage.removeItem(GEMINI_API_STORAGE_KEY);
  } catch { console.error('API 키 저장 실패'); }
}

/** Crop from the source, never from the downscaled display image. */
async function prepareTargetCrop(source: string | File, geometry: VisionProcessResult) {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('원본 이미지 로드 실패')); img.src = url; });
    const scale = Math.max(800 / img.width, 800 / img.height);
    const ox = (800 - img.width * scale) / 2, oy = (800 - img.height * scale) / 2;
    const c = geometry.calibration;
    const margin = c.targetType === 'standard' ? c.blackRadiusPx * 1.72 : 200;
    const x = Math.max(0, Math.floor((c.centerX - margin - ox) / scale));
    const y = Math.max(0, Math.floor((c.centerY - margin - oy) / scale));
    const width = Math.min(img.width - x, Math.ceil((c.centerX + margin - ox) / scale) - x);
    const height = Math.min(img.height - y, Math.ceil((c.centerY + margin - oy) / scale) - y);
    if (width <= 0 || height <= 0) throw new Error('표적 영역을 찾지 못했습니다.');
    const canvas = document.createElement('canvas');
    const factor = Math.min(1, 2048 / Math.max(width, height));
    canvas.width = Math.round(width * factor); canvas.height = Math.round(height * factor);
    canvas.getContext('2d')!.drawImage(img, x, y, width, height, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL('image/jpeg', .96).split(',')[1],
      width: canvas.width, height: canvas.height,
      map: { x: x * scale + ox, y: y * scale + oy, width: width * scale, height: height * scale } };
  } finally { if (typeof source !== 'string') URL.revokeObjectURL(url); }
}

export async function analyzeTargetWithGemini(source: string | File, apiKey: string,
  options?: { mode?: TargetMode; targetCount?: number; geometry?: VisionProcessResult }): Promise<VisionProcessResult> {
  if (!apiKey.trim()) throw new Error('설정에서 Gemini API 키를 등록해주세요.');
  const geometry = options?.geometry ?? await processTargetImage(source, undefined, options);
  const crop = await prepareTargetCrop(source, geometry);
  const prompt = `Analyze this cropped paper shooting target. Identify individually distinguishable pellet-hole centers using visible circular arcs, torn edges and exposed backing. Ignore printed lines and handwriting. Overlapping cavities may contain multiple centers only where visible image evidence supports them. Completely hidden impacts have no recoverable position: do not invent coordinates. Do not infer a shot quota. Return JSON {"shots":[{"x":number,"y":number}]} with coordinates normalized from 0 to 1000 separately along the cropped image width and height, top-left origin. Return [] if none. Do not return scores; calibrated geometry computes them separately.`;
  let text: string | undefined, modelUsed = '', lastFailure = '';
  for (const model of ['gemini-3.5-flash', 'gemini-flash-latest']) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${import.meta.env.DEV ? '/api/gemini' : 'https://generativelanguage.googleapis.com/v1beta'}/models/${model}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey.trim() },
        signal: controller.signal,
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/jpeg', data: crop.data } }] }],
          generationConfig: { temperature: 1, thinkingConfig: { thinkingLevel: 'low' }, maxOutputTokens: 4096, response_mime_type: 'application/json',
            response_schema: { type: 'OBJECT', properties: { shots: { type: 'ARRAY', items: { type: 'OBJECT', properties: { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } }, required: ['x', 'y'] } } }, required: ['shots'] } } }) });
      if ([404, 500, 502, 503, 504].includes(response.status)) { lastFailure = `Gemini HTTP ${response.status}`; continue; }
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
      const body = await response.json();
      text = body.candidates?.[0]?.content?.parts?.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought).map((p: { text: string }) => p.text).join('');
      modelUsed = model; break;
    } catch (error) {
      if (controller.signal.aborted) lastFailure = 'Gemini 응답 시간 초과 (60초)';
      else throw error;
    } finally { clearTimeout(timeout); }
  }
  if (!text) throw new Error(lastFailure || 'Gemini에서 분석 JSON을 받지 못했습니다.');
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.shots)) throw new Error('Gemini shots 형식이 올바르지 않습니다.');
  const c = geometry.calibration;
  const candidates: ShotPoint[] = [];
  for (const p of parsed.shots.slice(0, 200)) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > 1000 || p.y > 1000) continue;
    const pixelX = crop.map.x + p.x / 1000 * crop.map.width;
    const pixelY = crop.map.y + p.y / 1000 * crop.map.height;
    if (candidates.some(s => Math.hypot(s.pixelX - pixelX, s.pixelY - pixelY) < 1)) continue;
    const s = calculateShotScore(pixelX, pixelY, c);
    candidates.push({ id: `ai-${candidates.length}`, shotNumber: candidates.length + 1, pixelX, pixelY,
      detectionStatus: 'estimated', score: s.score, distance_mm: s.distanceMm, offsetX_mm: s.offsetX_mm, offsetY_mm: s.offsetY_mm });
  }
  const fusion = fuseGeminiCandidates(geometry.detectedShots, candidates, geometry.unresolvedRegions ?? [], c);
  return { ...geometry, detectedShots: fusion.shots,
    aiComparison: { model: modelUsed, inputWidth: crop.width, inputHeight: crop.height,
      localShots: geometry.detectedShots, aiShots: candidates, matched: fusion.matched, added: fusion.added, rejected: fusion.rejected },
    warnings: [...(geometry.warnings ?? []),
      `Gemini 원본 표적 영역 ${crop.width}×${crop.height}px · ${modelUsed}. 기존 ${geometry.detectedShots.length}개 보존 / AI 일치 ${fusion.matched}개 / 원본 구멍 지지 추가 감지 ${fusion.added}개 / 미지지·중복 제외 ${fusion.rejected}개.`,
      'AI 일치는 정확도 검증이 아닙니다. 완전히 겹쳐 보이지 않는 발수와 위치는 계속 추정 핀으로 표시합니다.'] };
}
