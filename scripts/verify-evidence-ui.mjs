const task=await taskSpace(globalThis.targetScannerTaskSpace ?? 'Target Scanner overlap 20261021'), page=task.page('p1');
const fs=await import('node:fs/promises');
const { fileURLToPath } = await import('node:url');
const path = await import('node:path');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const photos=JSON.parse(await fs.readFile(root+'/outputs/native/results.json','utf8')).photos;
const checks=[];
await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
for(const p of photos){
 await page.goto('http://127.0.0.1:5173');
 await page.setInputFiles('input[aria-label="앨범 사진 선택"]',[root+'/'+p.name]);
 await page.waitForFunction(()=>document.querySelector('button[aria-pressed]')?.disabled===false);
 await page.click(`loc=role:button[name="${p.expected}발"]`);
 await page.waitForFunction(n=>document.querySelector('tbody')?.rows.length===n,p.shots.length);
 const text=await page.evaluate(()=>document.querySelector('[aria-label="핀 상태 범례"]').textContent);
 for(const [label,key] of [['감지','detected'],['추정','estimated'],['미확정','unresolved']])if(!text.includes(`${label} ${p.summary[key]}`))throw Error(p.name+' '+label);
 checks.push(p.name+': UI detected/estimated/unresolved match fitted results');
}
await page.click('loc=role:button[name="분석 결과"]');
await page.screenshot({path:root+'/outputs/overlap/mobile-results.png'});
await page.click('loc=role:button[name="기록 저장"]');
const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('targetscan_sessions'))[0]);
if(s.shots.filter(s=>s.detectionStatus==='estimated').length!==photos[5].summary.estimated||s.unresolvedRegions.length!==photos[5].regions.length||!s.shots.some(s=>s.evidence?.visibleArcDeg>=120))throw Error('Evidence persistence');
await page.click('nav[aria-label="주요 작업"] button >> nth=2');
await page.click(`[data-session-id="${s.id}"] button[title="기록 삭제"]`);
await page.click('loc=role:button[name="기록 닫기"]');
checks.push('Saved status, arc evidence and unresolved regions; removed only test record');
await fs.writeFile(root+'/outputs/overlap/ui-checks.json',JSON.stringify(checks,null,2));
console.log({passed:checks.length,checks});
