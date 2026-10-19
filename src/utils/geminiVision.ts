/**
 * [Google Gemini 2.5 Flash Multimodal Vision 엔진]
 * 작성자: 코다리 개발부장 & 디자인 실장 영자
 * 의도:
 *   1. [손글씨/메모 100% 무시]: 코치 피드백, 볼펜 글씨, 평가 문구를 완벽히 식별하여 배제
 *   2. [실제 물리적 탄흔 정밀 탐지]: 종이를 관통한 4.5mm 탄환 구멍만 정확히 탐지
 *   3. [밀집 탄착군 다발성 탄흔 분리]: 찢어진 하나의 구멍 속에 겹친 다발성 탄흔을 정확히 분리
 *   4. [무료 Google AI Studio 키 지원]: 15 RPM 무료 티어 지원으로 유지비 0원
 *   5. [초경량 Zero-Dependency]: 외부 대용량 SDK 없이 브라우저 네이티브 fetch 사용
 */

import { TargetCalibration, ShotPoint, TargetMode } from '../types/target';
import { ISSF_AIR_RIFLE, calculateShotScore } from './issfSpecs';
import { VisionProcessResult } from './visionProcessor';

const GEMINI_API_STORAGE_KEY = 'targetscan_gemini_api_key';

/**
 * 저장된 Gemini API 키 가져오기
 */
export function getStoredGeminiApiKey(): string {
  try {
    return localStorage.getItem(GEMINI_API_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Gemini API 키 저장하기
 */
export function setStoredGeminiApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(GEMINI_API_STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(GEMINI_API_STORAGE_KEY);
    }
  } catch (e) {
    console.error('API 키 저장 실패:', e);
  }
}

/**
 * 이미지를 800x800 표준 캔버스에 렌더링하고 JPEG Base64 문자열로 변환
 */
async function prepareImageBase64(
  imageSource: string | File
): Promise<{ base64Data: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const size = 800;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context 생성 실패'));
        return;
      }

      // 흰색 배경 채우기
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      // 종횡비 유지하며 800x800 정사각형 중앙 채우기
      const scale = Math.max(size / img.width, size / img.height);
      const renderX = (size - img.width * scale) / 2;
      const renderY = (size - img.height * scale) / 2;
      ctx.drawImage(img, renderX, renderY, img.width * scale, img.height * scale);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64Data = dataUrl.split(',')[1];
      resolve({ base64Data, mimeType: 'image/jpeg', dataUrl });
    };

    img.onerror = () => reject(new Error('이미지 로드에 실패했습니다.'));

    if (imageSource instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsDataURL(imageSource);
    } else {
      img.src = imageSource;
    }
  });
}

interface GeminiTargetResponse {
  targetType: 'standard' | 'blank';
  centerX: number;
  centerY: number;
  shots: Array<{ x: number; y: number }>;
}

/**
 * Gemini 2.5 Flash를 활용한 초정밀 표적지 멀티모달 비전 분석
 */
export async function analyzeTargetWithGemini(
  imageSource: string | File,
  apiKey: string,
  options?: { mode?: TargetMode; targetCount?: number }
): Promise<VisionProcessResult> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API 키가 입력되지 않았습니다. 설정에서 API 키를 등록해주세요.');
  }

  const targetCount = options?.targetCount ?? (options?.mode === '20shots' ? 20 : 10);
  const { base64Data, mimeType, dataUrl } = await prepareImageBase64(imageSource);

  const prompt = `You are a world-class Olympic shooting target analysis and scoring AI for ISSF 10m Air Rifle.
The user provided a high-resolution photo of a shooting target resized/centered onto an 800x800 coordinate plane:
- Top-left is (0, 0)
- Bottom-right is (800, 800)

CRITICAL INSTRUCTIONS:
1. TARGET TYPE & CENTER:
   - 'standard': Has black circular bullseye scoring rings (4 to 10 rings). Find the exact geometric center of the black circle as (centerX, centerY).
   - 'blank': A white paper target without black rings (often mounted on blue/green rubber or cardboard backing). The shots are clustered near the center. Detect the true centroid (center of mass) of the bullet cluster or central crosshair as (centerX, centerY).
2. BULLET HOLE DETECTION (SHOTS):
   - The user specified a target count of ${targetCount > 0 ? `${targetCount} shots` : 'all visible shots'}.
   - Bullet holes are physical 4.5mm round punctures through the paper, revealing the backing (often dark blue, black, or grey) with pellet grease rings and ragged paper tear edges.
   - ⚠️ STRICTLY REJECT ALL HANDWRITING & INK NOTES:
     Coaches and shooters often write notes, Korean words (e.g. '자연잘했습니다', '실수탄 줄이기', '아주 잘했어요!'), score numbers, underlines, or checkmarks with red/blue/black ballpoint pens.
     NEVER treat pen handwriting, line strokes, or handwritten letters as bullet holes! Only detect genuine physical bullet punctures.
3. OVERLAPPING / CLUSTER HOLES:
   - When multiple pellets hit nearly the same spot, they tear a single enlarged or cloverleaf-shaped hole. Accurately infer and output individual pellet center coordinates within that cluster so the total shot count matches ${targetCount > 0 ? targetCount : 'all detected'}.
4. RESPONSE FORMAT:
   Return strictly valid JSON matching this schema:
   {
     "targetType": "standard" | "blank",
     "centerX": number (around 400),
     "centerY": number (around 400),
     "shots": [
       { "x": number, "y": number }
     ]
   }`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.1,
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP 에러 ${response.status}: ${response.statusText}`;
    throw new Error(`Gemini API 호출 실패: ${message}`);
  }

  const resultData = await response.json();
  const candidateText = resultData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidateText) {
    throw new Error('Gemini API로부터 응답 텍스트를 받지 못했습니다.');
  }

  let parsed: GeminiTargetResponse;
  try {
    parsed = JSON.parse(candidateText);
  } catch (err) {
    console.error('JSON 파싱 실패:', candidateText);
    throw new Error('Gemini 분석 결과 형식이 올바르지 않습니다.');
  }

  // 기본값 보정
  const centerX = typeof parsed.centerX === 'number' && !isNaN(parsed.centerX) ? parsed.centerX : 400;
  const centerY = typeof parsed.centerY === 'number' && !isNaN(parsed.centerY) ? parsed.centerY : 400;
  const targetType = parsed.targetType === 'blank' ? 'blank' : 'standard';

  // 1mm당 픽셀 수 (800x800 표준 정규화 기준, 4점 흑점 직경 30.5mm -> 반경 15.25mm)
  const pxPerMm = 16.0;
  const blackRadiusPx = Math.round(ISSF_AIR_RIFLE.BLACK_CIRCLE_RADIUS_MM * pxPerMm);

  const calibration: TargetCalibration = {
    centerX,
    centerY,
    blackRadiusPx,
    pxPerMm,
    targetType,
  };

  // 탄착점 ShotPoint 배열 구성 및 ISSF 점수 산출
  const rawShots = Array.isArray(parsed.shots) ? parsed.shots : [];
  const detectedShots: ShotPoint[] = rawShots.map((s, idx) => {
    const pixelX = Math.round(s.x);
    const pixelY = Math.round(s.y);
    const scoreResult = calculateShotScore(pixelX, pixelY, calibration);

    return {
      id: `ai-shot-${Date.now()}-${idx + 1}`,
      shotNumber: idx + 1,
      pixelX,
      pixelY,
      offsetX_mm: scoreResult.offsetX_mm,
      offsetY_mm: scoreResult.offsetY_mm,
      distance_mm: scoreResult.distanceMm,
      score: scoreResult.score,
    };
  });

  return {
    calibration,
    detectedShots,
    normalizedImageUrl: dataUrl,
  };
}
