const fs=await import('node:fs/promises'),path=await import('node:path'),{fileURLToPath}=await import('node:url');const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const task=await taskSpace(globalThis.targetScannerTaskSpace??'Target Scanner selected counts 005 006'),p=task.page('p1');const checks=[],rows=[];
const assert=(v,s)=>{if(!v)throw Error(s);checks.push(s);};
const click=async s=>{await p.evaluate(s=>{const m=s.match(/^loc=role:button\[name="(.+)"\]$/),el=m?[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&(b.getAttribute('aria-label')===m[1]||b.textContent?.trim()===m[1])):!s.includes('>>')&&!s.includes(':text-is')?document.querySelector(s):null;el?.scrollIntoView({block:'center'});},s);await p.click(s);};
await fs.mkdir(root+'/outputs/selected-counts',{recursive:true});await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
for(const photo of ['005','006']){
 await p.goto('http://127.0.0.1:5173');const name=`KakaoTalk_Photo_2026-10-19-18-36-39 ${photo}.jpeg`;
 await p.setInputFiles('input[aria-label="앨범 사진 선택"]',[root+'/'+name]);await p.waitForFunction(()=>document.querySelector('button[aria-pressed]')?.disabled===false);
 let originalCoordinates;
 for(const count of [10,15,20,30]){
  await click(`loc=role:button[name="${count}발"]`);
  await p.waitForFunction(n=>{const e=document.querySelector('[aria-label="선택 발수 추정 총점"]');return e?.dataset.estimateReady==='true'&&e.textContent.includes(`${n}발 기준`);},count,{timeout:60000});
  assert(await p.evaluate(()=>document.querySelector('input[aria-label="부족 발수 겹침 가정"]').checked),`${photo}/${count}: missing shots assumed overlapping by default`);
  assert(await p.evaluate(()=>!document.querySelector('input[aria-label="발수와 점수 검토 완료"]').checked&&!document.querySelector('input[aria-label="링 보정 확인"]').checked),`${photo}/${count}: full estimate available without acknowledgment or ring checkbox`);
  const virtual=await p.evaluate(()=>document.querySelectorAll('[data-virtual-pin]').length),located=await p.evaluate(()=>document.querySelector('tbody').rows.length);
  assert(virtual+located===count,`${photo}/${count}: real plus virtual pins equal selected count`);
  await click('loc=role:button[name="분석 결과"]');
  const ui=await p.evaluate(()=>({total:Number(document.querySelector('[aria-label="선택 발수 추정 총점"]').dataset.estimateTotal),text:document.querySelector('[aria-label="선택 발수 추정 총점"]').textContent}));
  assert(ui.text.includes('감지 (')&&ui.text.includes('추정 ('),`${photo}/${count}: image and virtual subtotals separately labeled`);
  for(const width of [320,390,1440]){await p.cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<768});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${photo}/${count}: no overflow at ${width}px`);}
  await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await p.evaluate(()=>document.querySelector('[aria-label="선택 발수 추정 총점"]').scrollIntoView({block:'center'}));await p.screenshot({path:root+`/outputs/selected-counts/${photo}-${count}.png`});
  await click('loc=role:button[name="기록 저장"]');const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('targetscan_sessions'))[0]);console.log('Test record:',saved.id);
  const coordinates=JSON.stringify(saved.shots.map(s=>[s.pixelX,s.pixelY,s.detectionStatus]));if(!originalCoordinates)originalCoordinates=coordinates;assert(coordinates===originalCoordinates,`${photo}/${count}: image detections unchanged across selected counts`);
  const imageScore=Math.round(saved.shots.reduce((sum,s)=>sum+s.score,0)*10)/10;
  const math=await p.evaluate(async s=>{const {createVirtualPins}=await import('/src/utils/virtualPins.ts');const pins=createVirtualPins(s.unresolvedRegions,s.scoreReviews,s.calibration,s.virtualPinEdits,s.shots);return {count:pins.length,sum:Math.round(pins.reduce((sum,p)=>sum+p.score,0)*10)/10};},saved);
  assert(math.count===virtual&&Math.abs(Math.round((math.sum+imageScore)*10)/10-ui.total)<.001,`${photo}/${count}: displayed total equals image plus virtual pin scores`);
  assert(saved.estimatedScore?.ready&&saved.estimatedScore.total===ui.total&&saved.stats.totalShots===located&&!saved.reviewedScore.complete,`${photo}/${count}: save keeps provisional full estimate distinct from reviewed score and real grouping`);
  await p.click('nav[aria-label="주요 작업"] button >> nth=2');assert(await p.evaluate(id=>document.querySelector(`[data-session-id="${id}"]`).textContent.includes('발 전체 추정'),saved.id),`${photo}/${count}: history displays full estimated score before confirmation`);
  await p.click(`[data-session-id="${saved.id}"] button:text-is("열기")`);await click('loc=role:button[name="분석 결과"]');assert(await p.evaluate(t=>Number(document.querySelector('[aria-label="선택 발수 추정 총점"]').dataset.estimateTotal)===t,ui.total),`${photo}/${count}: full estimate restores`);
  await p.click('nav[aria-label="주요 작업"] button >> nth=2');await p.click(`[data-session-id="${saved.id}"] button[title="기록 삭제"]`);await click('button[aria-label="기록 닫기"]');
  rows.push({photo,count,detected:saved.shots.filter(s=>s.detectionStatus==='detected').length,separated:saved.shots.filter(s=>s.detectionStatus==='estimated').length,virtual,imageScore,virtualScore:math.sum,total:ui.total});
  // Restore loaded file context lost by history load, then select the next count.
  if(count!==30){await p.setInputFiles('input[aria-label="앨범 사진 선택"]',[root+'/'+name]);await p.waitForFunction(()=>document.querySelector('button[aria-pressed]')?.disabled===false);}
 }
}
await fs.writeFile(root+'/outputs/selected-counts/results.json',JSON.stringify({rows,checks,scope:'Full selected-count overlap assumption; not ground truth'},null,2));console.log({passed:checks.length,rows});
