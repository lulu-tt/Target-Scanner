const fs=await import('node:fs/promises'),path=await import('node:path'),{fileURLToPath}=await import('node:url');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const task=await taskSpace(globalThis.targetScannerTaskSpace??'Target Scanner auto review 20261021'),page=task.page('p1');
const checks=[],photos=[];const files=(await fs.readdir(root)).filter(n=>/^KakaoTalk_Photo_.*\.jpeg$/.test(n)).sort();
const assert=(condition,name)=>{if(!condition)throw Error(name);checks.push(name);};
const click=async s=>{await page.evaluate(s=>{const role=s.match(/^loc=role:button\[name="(.+)"\]$/);const el=role?[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&(b.getAttribute('aria-label')===role[1]||b.textContent?.trim()===role[1])):!s.includes('>>')&&!s.includes(':text-is')?document.querySelector(s):null;el?.scrollIntoView({block:'center'});},s);await page.click(s);};
await fs.mkdir(root+'/outputs/auto-review',{recursive:true});
await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
for(const [i,name] of files.entries()){
 await page.goto('http://127.0.0.1:5173');
 const expected=i===0||i===5?10:20;
 const data=await page.evaluate(async({name,expected})=>{
  const {processTargetImage}=await import('/src/utils/visionProcessor.ts');const {proposeRegions}=await import('/src/utils/regionProposals.ts');
  const r=await processTargetImage('/'+encodeURIComponent(name),undefined,{targetCount:expected});
  return {name,expected,located:r.detectedShots.length,regions:r.unresolvedRegions,calibration:r.calibration,area:proposeRegions(r.unresolvedRegions,r.detectedShots,r.calibration,expected),conditioned:proposeRegions(r.unresolvedRegions,r.detectedShots,r.calibration,expected,true)};
 },{name,expected});photos.push(data);
 assert(data.area.length>0,`Photo ${i+1}: image geometry supplies automatic region proposals`);
 assert(data.conditioned.reduce((s,r)=>s+r.additionalCount,0)+data.located===expected,`Photo ${i+1}: explicit overlap assumption accounts for reported count`);
 await page.setInputFiles('input[aria-label="앨범 사진 선택"]',[root+'/'+name]);await page.waitForFunction(()=>document.querySelector('button[aria-pressed]')?.disabled===false);await click(`loc=role:button[name="${expected}발"]`);
 await page.waitForFunction(()=>!!document.querySelector('[aria-label="총점 완성"]'),undefined,{timeout:60000});
 if(i>=4)await click('input[aria-label="링 보정 확인"]');
 await click('loc=role:button[name="분석 결과"]');
 const counts=await page.evaluate(()=>[...document.querySelectorAll('input[aria-label$="추가 발수"]')].map(e=>Number(e.value)));
 assert(counts.reduce((s,n)=>s+n,0)===data.area.reduce((s,r)=>s+r.additionalCount,0),`Photo ${i+1}: area count proposals are prefilled in UI`);
 assert(await page.evaluate(()=>document.querySelector('[data-score-complete]').dataset.scoreComplete==='false'),`Photo ${i+1}: proposal never silently becomes confirmed`);
 await click('input[aria-label="미배정 탄착 모두 겹침으로 확인"]');
 const sum=await page.evaluate(()=>[...document.querySelectorAll('input[aria-label$="추가 발수"]')].reduce((s,e)=>s+Number(e.value),0));
 assert(sum+data.located===expected,`Photo ${i+1}: one assumption confirmation fills remaining region counts`);
 if(i<4){
  assert(await page.evaluate(()=>[...document.querySelectorAll('input[aria-label$="확인 점수"]')].every(e=>e.value==='')),`Photo ${i+1}: blank target never invents a geometric score`);
 }else{
  assert(await page.evaluate(()=>[...document.querySelectorAll('input[aria-label$="확인 점수"]')].every(e=>e.value!=='')),`Photo ${i+1}: printed target scores are automatically prefilled`);
  await click('input[aria-label="발수와 점수 검토 완료"]');
  assert(await page.evaluate(()=>document.querySelector('[data-score-complete]').dataset.scoreComplete==='true'&&document.querySelector('[data-score-complete]').textContent.includes('사용자 확인 추정 총점')),`Photo ${i+1}: confirmation alone completes estimated total`);
  const old=await page.evaluate(()=>document.querySelector('input[aria-label="영역 1 추가 발수"]').value);
  await page.fill('input[aria-label="영역 1 추가 발수"]',String(expected+1));await click('input[aria-label="발수와 점수 검토 완료"]');
  assert(await page.evaluate(()=>document.querySelector('[data-score-complete]').dataset.scoreComplete==='false'),`Photo ${i+1}: excessive correction cannot finalize`);
  await page.fill('input[aria-label="영역 1 추가 발수"]',old);
  const score=await page.evaluate(()=>Number(document.querySelector('input[aria-label="영역 1 확인 점수"]').value));
  await page.fill('input[aria-label="영역 1 확인 점수"]',String(Math.max(0,Math.round((score-.1)*10)/10)));
  await click('input[aria-label="발수와 점수 검토 완료"]');
 }
 for(const width of [320,390,1440]){await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<768});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Photo ${i+1}: no overflow at ${width}px`);}
 await page.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await page.evaluate(()=>document.querySelector('[aria-label="총점 완성"]').scrollIntoView({block:'start'}));await page.screenshot({path:root+`/outputs/auto-review/photo-${i+1}.png`});
 await click('loc=role:button[name="기록 저장"]');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('targetscan_sessions'))[0]);console.log('Temporary test record:',saved.id);
 assert(saved.countConditioned&&saved.scoreReviews.some(r=>r.source==='count-conditioned'||r.source==='manual'),`Photo ${i+1}: assumptions and proposal origins persist`);
 await page.click('nav[aria-label="주요 작업"] button >> nth=2');await page.click(`[data-session-id="${saved.id}"] button:text-is("열기")`);await click('loc=role:button[name="분석 결과"]');
 const restored=await page.evaluate(()=>[...document.querySelectorAll('input[aria-label$="추가 발수"]')].map(e=>Number(e.value)));
 assert(restored.reduce((s,n)=>s+n,0)+data.located===expected,`Photo ${i+1}: accepted proposals and edits restored`);
 if(i>=4){const expectedScore=saved.scoreReviews.find(r=>r.regionId===data.regions[0].id).confirmedTotal;const restoredScore=await page.evaluate(()=>Number(document.querySelector('input[aria-label="영역 1 확인 점수"]').value));assert(restoredScore===expectedScore,`Photo ${i+1}: corrected score survives save and restore`);}

 await page.click('nav[aria-label="주요 작업"] button >> nth=2');await page.click(`[data-session-id="${saved.id}"] button[title="기록 삭제"]`);await click('button[aria-label="기록 닫기"]');
}
await fs.writeFile(root+'/outputs/auto-review/results.json',JSON.stringify({photos,checks,scope:'Heuristic proposals and UI validation; not ground-truth score accuracy'},null,2));console.log({passed:checks.length,summary:photos.map(p=>({photo:p.name.slice(-8,-5),located:p.located,area:p.area,conditioned:p.conditioned}))});
