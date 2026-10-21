// Run against a local Vite server:
// ego-browser nodejs -e 'await import("file:///absolute/path/scripts/verify-vision.mjs")'
const fs = await import('node:fs/promises');
const path = await import('node:path');
const { fileURLToPath } = await import('node:url');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const task = await taskSpace(globalThis.targetScannerTaskSpace ?? 'Target Scanner accuracy 20261021');
const page = task.page('p1');
await page.goto('http://127.0.0.1:5173');
const files = (await fs.readdir(root)).filter(name => /^KakaoTalk_Photo_.*\.jpeg$/.test(name)).sort();
if (files.length !== 6) throw new Error(`Expected six local photos, got ${files.length}`);
const result = await page.evaluate(async ({ files }) => {
  const { processTargetImage } = await import('/src/utils/visionProcessor.ts');
  const { analyzeTargetWithGemini } = await import('/src/utils/geminiVision.ts');
  const checks = [];
  const assert = (condition, name) => {
    if (!condition) throw new Error(name);
    checks.push(name);
  };
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 800;
  const ctx = canvas.getContext('2d');
  const makeImage = (positions = []) => {
    ctx.fillStyle = '#e8dfd0'; ctx.fillRect(0, 0, 800, 800);
    ctx.fillStyle = '#254c85';
    for (const [x, y] of positions) {
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
    }
    return canvas.toDataURL();
  };
  const emptyUrl = makeImage();
  for (const count of [0, 10, 20, 30]) {
    const r = await processTargetImage(emptyUrl, undefined, { targetCount: count });
    assert(r.detectedShots.length === 0, `Empty image stays empty (count ${count})`);
  }
  const oneUrl = makeImage([[400, 400]]);
  for (const count of [0, 10, 20, 30]) {
    const r = await processTargetImage(oneUrl, undefined, { targetCount: count });
    assert(r.detectedShots.length === 1, `One hole is not split (count ${count})`);
    assert(Math.hypot(r.detectedShots[0].pixelX - 400, r.detectedShots[0].pixelY - 400) <= 2, 'Synthetic center within 2px');
  }
  for (const [positions, expected, name] of [
    [[[380, 400], [418, 400]], 2, 'Nearby holes separated by paper remain separate'],
    [[[390, 400], [410, 400]], 0, 'Merged cavity without a radius reference remains unresolved'],
  ]) {
    const r = await processTargetImage(makeImage(positions), undefined, { targetCount: 20 });
    assert(r.detectedShots.length === expected, name);
  }
  const manyPositions = Array.from({ length: 12 }, (_, i) => [220 + (i % 6) * 65, 340 + Math.floor(i / 6) * 90]);
  const manyUrl = makeImage(manyPositions);
  for (const count of [0, 10, 30]) {
    const r = await processTargetImage(manyUrl, undefined, { targetCount: count });
    assert(r.detectedShots.length === 12, `12 holes preserved without cap or padding (count ${count})`);
  }
  const originalFetch = window.fetch;
  let responseShots = [];
  let capturedPrompt = '';
  window.fetch = async (url, options) => {
    if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) throw new Error('Unexpected test fetch');
    capturedPrompt = JSON.parse(options.body).contents[0].parts[0].text;
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ targetType: 'standard', centerX: 500, centerY: 500, blackRadius: 120, shots: responseShots }) }] } }] }), { status: 200 });
  };
  try {
    let r = await analyzeTargetWithGemini(emptyUrl, 'test-only-not-a-key', { targetCount: 20 });
    assert(r.detectedShots.length === 0, 'Gemini empty response stays empty');
    assert(capturedPrompt.includes('NEVER distribute, invent, or duplicate'), 'Gemini prompt prohibits invented coordinates');
    responseShots = [{ x: 500, y: 500 }, { x: 510, y: 520 }];
    for (const count of [0, 1, 20]) {
      r = await analyzeTargetWithGemini(emptyUrl, 'test-only-not-a-key', { targetCount: count });
      assert(r.detectedShots.length === 2 && r.detectedShots.every(s => s.detectionStatus === 'estimated'), `Gemini estimates unchanged by count ${count}`);
    }
    responseShots = [null, {}, { x: '500', y: 500 }, { x: -1, y: 500 }, { x: 1001, y: 500 }, { x: 500 }, { x: 500, y: 500 }, { x: 500, y: 500 }, { x: 1, y: 1 }];
    r = await analyzeTargetWithGemini(emptyUrl, 'test-only-not-a-key', { targetCount: 20 });
    assert(r.detectedShots.length === 1 && r.detectedShots[0].pixelX === 400, 'Invalid, duplicate and outside-ROI Gemini coordinates are not replaced with center pins');
  } finally { window.fetch = originalFetch; }
  return { checks, photos: [] };
}, { files });
for (const [i, name] of files.entries()) {
  const photo = await page.evaluate(async ({ i, name }) => {
    const { processTargetImage } = await import('/src/utils/visionProcessor.ts');
    const variants = [];
    for (const count of [0, 10, 20, 30]) {
      variants.push(await processTargetImage('/' + encodeURIComponent(name), undefined, { mode: i < 4 ? 'blank' : 'free', targetCount: count }));
    }
    const coordinates = r => r.detectedShots.map(s => [s.pixelX, s.pixelY]);
    if (!variants.every(r => JSON.stringify(coordinates(r)) === JSON.stringify(coordinates(variants[0])))) throw new Error('Coordinates changed with selected count: ' + name);
    return { name, calibration: variants[0].calibration, shots: variants[0].detectedShots, warnings: variants[0].warnings };
  }, { i, name });
  result.checks.push(`${name}: coordinates independent of selected count`);
  result.photos.push(photo);
}
await fs.mkdir(path.join(root, 'outputs/accuracy'), { recursive: true });
await fs.writeFile(path.join(root, 'outputs/overlap/regression.json'), JSON.stringify(result, null, 2));
console.log({ passed: result.checks.length, photos: result.photos.map(r => ({ file: r.name, candidates: r.shots.length, type: r.calibration.targetType })) });
