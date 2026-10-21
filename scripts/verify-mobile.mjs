// Run with ego-browser nodejs -e 'await import("file:///absolute/project/scripts/verify-mobile.mjs")'
const fs = await import('node:fs/promises');
const path = await import('node:path');
const { fileURLToPath } = await import('node:url');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const task = await taskSpace(globalThis.targetScannerTaskSpace ?? 'Target Scanner mobile UX 20261021');
const page = task.page('p1');
const click = async selector => {
  await page.evaluate(selector => {
    const role = selector.match(/^loc=role:button\[name="(.+)"\]$/);
    const el = role ? [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === role[1] || b.textContent?.trim() === role[1]) : !selector.includes('>>') && !selector.includes(':text-is') ? document.querySelector(selector) : null;
    el?.scrollIntoView({ block: 'center' });
  }, selector);
  await page.click(selector);
};
const checks = [];
const assert = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
const viewport = async (width, height = 844) => {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
};
const count = () => page.evaluate(() => document.querySelector('tbody')?.rows.length ?? 0);
const layout = () => page.evaluate(() => ({
  width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
  shortButtons: [...document.querySelectorAll('button')].filter(el => el.getClientRects().length && !el.disabled && el.getBoundingClientRect().height < 43).map(el => el.textContent?.trim()),
}));
await fs.mkdir(path.join(root, 'outputs/mobile'), { recursive: true });
await page.goto('http://127.0.0.1:5173');
await viewport(390);
await page.waitForSelector('input[aria-label="앨범 사진 선택"]', { state: 'attached' });
assert(await page.evaluate(() => document.body.innerText.includes('첫 표적을 등록해보세요')), 'Initial screen has an explicit empty state');
await page.screenshot({ path: path.join(root, 'outputs/mobile/01-start.png') });
await page.setInputFiles('input[aria-label="앨범 사진 선택"]', [path.join(root, 'KakaoTalk_Photo_2026-10-19-18-36-39 006.jpeg')]);
await page.waitForFunction(() => document.querySelector('button[aria-pressed]')?.disabled === false);
await click('loc=role:button[name="10발"]');
await page.waitForFunction(() => document.body.innerText.includes('후보 5개 / 선택 10발'));
assert(await count() === 5, 'Photo 006 still produces five candidates');
await click('canvas[aria-label="표적 사진과 탄착점"]');
assert(await count() === 5, 'Viewing a target does not add pins');
await click('loc=role:button[name="위치 수정"]');
const point = await page.evaluate(() => {
  const r = document.querySelector('canvas[aria-label="표적 사진과 탄착점"]').getBoundingClientRect();
  return { x: r.left + r.width * .2, y: r.top + r.height * .25 };
});
await page.cdp('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
await page.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
await page.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
assert(await count() === 6, 'One touch adds exactly one pin in edit mode');
await page.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
await page.cdp('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + 18, y: point.y + 10, id: 1 }] });
await page.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
assert(await count() === 6, 'Dragging a pin does not create another');
await click('loc=role:button[name="선택 핀 삭제"]');
assert(await count() === 5, 'Selected pin can be deleted by touch button');
await click('loc=role:button[name="수정 완료"]');
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '표시 설정')?.scrollIntoView({ block: 'center' }));
await click('loc=role:button[name="표시 설정"]');
await click('loc=role:button[name="표적 중심·크기 보정"]');
assert((await layout()).shortButtons.length === 0, 'Calibration controls retain 44px touch height');
await click('loc=role:button[name="보정 완료"]');
await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '표시 설정')?.scrollIntoView({ block: 'center' }));
await click('loc=role:button[name="표시 설정"]');
await click('loc=role:button[name="확대"]');
assert(await page.evaluate(() => document.body.innerText.includes('125%')), 'Zoom controls are available');
await click('loc=role:button[name="확대 초기화"]');
await page.screenshot({ path: path.join(root, 'outputs/mobile/02-target.png') });
await click('loc=role:button[name="분석 결과"]');
for (const width of [320, 390, 430, 768, 1440]) {
  await viewport(width);
  const state = await layout();
  assert(state.scrollWidth <= state.width + 1, `No horizontal page overflow at ${width}px`);
  assert(state.shortButtons.length === 0, `Visible enabled buttons are at least 44px high at ${width}px: ${state.shortButtons}`);
  await page.screenshot({ path: path.join(root, `outputs/mobile/results-${width}.png`) });
}
await viewport(390);
await click('loc=role:button[name="테마 전환"]');
await page.waitForFunction(() => getComputedStyle(document.querySelector('#root > div')).backgroundColor === 'rgb(12, 16, 20)');
await page.screenshot({ path: path.join(root, 'outputs/mobile/03-dark.png') });
await click('loc=role:button[name="테마 전환"]');
await click('loc=role:button[name="분석 설정"]');
for (const height of [844, 420]) {
  await viewport(320, height);
  const state = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]'); const r = d.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: innerHeight, width: d.scrollWidth, viewport: innerWidth, locked: document.body.style.overflow === 'hidden' };
  });
  assert(state.top >= 0 && state.bottom <= state.height + 1 && state.width <= state.viewport && state.locked, `Settings sheet fits ${height}px height and locks background`);
}
await page.keyboard.press('Tab');
assert(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)), 'Dialog keeps keyboard focus inside');
await page.keyboard.press('Escape');
assert(await page.evaluate(() => !document.querySelector('[role="dialog"]') && document.activeElement?.getAttribute('aria-label') === '분석 설정'), 'Escape closes dialog and returns focus');
await viewport(390);
const previousIds = await page.evaluate(() => JSON.parse(localStorage.getItem('targetscan_sessions') || '[]').map(s => s.id));
await click('loc=role:button[name="기록 저장"]');
const saved = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('targetscan_sessions') || '[]')[0];
  return s && { id: s.id, mode: s.mode, calibration: s.calibration, warnings: s.analysisWarnings, count: s.shots.length };
});
assert(saved && !previousIds.includes(saved.id) && saved.count === 5 && saved.mode === '10shots' && saved.calibration?.pxPerMm > 0 && saved.warnings?.length > 0, 'Saving retains mode, calibration and uncertainty with five candidates');
// Locate only the record created by this test; preserve any pre-existing user records.
await click('nav[aria-label="주요 작업"] button >> nth=2');
await page.waitForSelector('[role="dialog"]');
await page.screenshot({ path: path.join(root, 'outputs/mobile/04-history.png') });
await click(`[data-session-id="${saved.id}"] button:text-is("열기")`);
assert(await count() === 5 && await page.evaluate(() => document.body.innerText.includes('후보 5개 / 선택 10발')), 'Saved record restores its target and mode');
await click('nav[aria-label="주요 작업"] button >> nth=2');
await click(`[data-session-id="${saved.id}"] button[title="기록 삭제"]`);
await click('loc=role:button[name="기록 닫기"]');
assert(await page.evaluate(id => !JSON.parse(localStorage.getItem('targetscan_sessions') || '[]').some(s => s.id === id), saved.id), 'Only the temporary test record was removed');
await click('loc=role:button[name="분석 설정"]');
await page.screenshot({ path: path.join(root, 'outputs/mobile/05-settings.png') });
await page.keyboard.press('Escape');
await fs.writeFile(path.join(root, 'outputs/mobile/checks.json'), JSON.stringify({ checks }, null, 2));
console.log({ passed: checks.length, checks });
console.log(await page.snapshot());
