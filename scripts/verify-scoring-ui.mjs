const fs=await import('node:fs/promises'), path=await import('node:path');
const {fileURLToPath}=await import('node:url');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const task=await taskSpace(globalThis.targetScannerTaskSpace??'Target Scanner native scoring 20261021'), page=task.page('p1');
const checks=[],photos=JSON.parse(await fs.readFile(root+'/outputs/native/results.json','utf8')).photos;
const assert=(x,label)=>{if(!x)throw Error(label);checks.push(label);};
const center=async selector=>page.evaluate(s=>{
 const role=s.match(/^loc=role:button\[name="(.+)"\]$/),text=s.match(/^summary:text-is\("(.+)"\)$/);
 const el=role?[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&(b.getAttribute('aria-label')===role[1]||b.textContent?.trim()===role[1])):text?[...document.querySelectorAll('summary')].find(b=>b.textContent===text[1]):!s.includes('>>')&&!s.includes(':text-is')?document.querySelector(s):null;
 el?.scrollIntoView({block:'center'});
},selector);
const click=async s=>{await center(s);await page.click(s);};
await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
for(const [i,p] of photos.entries()){
 await page.goto('http://127.0.0.1:5173/');
 await page.setInputFiles('input[aria-label="앨범 사진 선택"]',[root+'/'+p.name]);
 await page.waitForFunction(()=>document.querySelector('button[aria-pressed]')?.disabled===false);
 await click(`loc=role:button[name="${p.expected}발"]`);
 await page.waitForFunction(()=>document.querySelector('[aria-label="총점 완성"]')&&document.body.textContent.includes('원본 '),undefined,{timeout:60000});
 const located=await page.evaluate(()=>document.querySelectorAll('tbody [data-detail-source="image"]').length);
 if(i>=4){
  assert(await page.evaluate(()=>document.body.innerText.includes('다중 링 4개 적합')),`Photo ${i+1}: multi-ring calibration shown`);
  await click('input[aria-label="링 보정 확인"]');
 }
 await click('loc=role:button[name="분석 결과"]');
 assert(await page.evaluate(()=>document.querySelector('[data-score-complete]').dataset.scoreComplete==='false'),`Photo ${i+1}: no automatic completed total`);
 let fixtureTotal;
 if(i<4){
  await click('summary:text-is("별도로 채점한 전체 총점 입력")');
  await page.fill('input[aria-label="별도 확인 전체 총점"]',String(p.expected*9));fixtureTotal=p.expected*9;
 }else{
  const regionCount=await page.evaluate(()=>document.querySelectorAll('input[aria-label$="추가 발수"]').length);
  for(let n=1;n<=regionCount;n++)await page.fill(`input[aria-label="영역 ${n} 추가 발수"]`,'0');
  const missing=p.expected-located;
  await page.fill('input[aria-label="영역 1 추가 발수"]',String(missing));
  await page.fill('input[aria-label="영역 1 확인 점수"]',String(missing*9));
  fixtureTotal=null;
 }
 await click('input[aria-label="발수와 점수 검토 완료"]');
 assert(await page.evaluate(()=>document.querySelector('[data-score-complete]').dataset.scoreComplete==='true'),`Photo ${i+1}: explicit user review completes total (fixture, not ground-truth scoring)`);
 assert(await page.evaluate(n=>document.querySelectorAll('tbody [data-detail-source="image"]').length===n,located),`Photo ${i+1}: area score never creates fake pins`);
 for(const width of [320,390,1440]){await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<768});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Photo ${i+1}: no overflow at ${width}px`);}
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await center('[aria-label="총점 완성"]');await page.screenshot({path:root+`/outputs/native/ui-${i+1}.png`});
 await click('loc=role:button[name="기록 저장"]');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('targetscan_sessions'))[0]);
 assert(saved.reviewedScore?.complete && (fixtureTotal===null||saved.reviewedScore.total===fixtureTotal),`Photo ${i+1}: completed score saved separately from coordinate stats`);
 await click('nav[aria-label="주요 작업"] button >> nth=2');
 assert(await page.evaluate(id=>document.querySelector(`[data-session-id="${id}"]`).textContent.includes('사용자 확인'),saved.id),`Photo ${i+1}: history shows reviewed total`);
 await click(`[data-session-id="${saved.id}"] button:text-is("열기")`);
 await click('loc=role:button[name="분석 결과"]');
 assert(await page.evaluate(()=>document.querySelector('[data-score-complete]').dataset.scoreComplete==='true'),`Photo ${i+1}: completed review restored`);
 if(i===5){
  await page.fill('input[aria-label="영역 1 추가 발수"]',String(p.expected));
  await click('input[aria-label="발수와 점수 검토 완료"]');
  assert(await page.evaluate(()=>document.querySelector('[data-score-complete]').dataset.scoreComplete==='false'),'Overcount invalidates total');
 }
 await click('nav[aria-label="주요 작업"] button >> nth=2');await click(`[data-session-id="${saved.id}"] button[title="기록 삭제"]`);await click('loc=role:button[name="기록 닫기"]');
}
await fs.writeFile(root+'/outputs/native/ui-checks.json',JSON.stringify({checks,scope:'UI fixture scores only; no ground-truth score accuracy claims'},null,2));
console.log({passed:checks.length,checks});
