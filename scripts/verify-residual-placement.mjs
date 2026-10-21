const fs=await import('node:fs/promises');const root='/Users/aaa/Documents/ChatGPT/Target Scanner';
const {execFileSync}=await import('node:child_process');
await fs.mkdir(root+'/work/residual-placement',{recursive:true});
for(const [name,source] of [['oldVirtualPins.ts','src/utils/virtualPins.ts'],['oldRegionProposals.ts','src/utils/regionProposals.ts']]){
 const previous=execFileSync('git',['show',`6f700ad:${source}`],{cwd:root,encoding:'utf8'})
  .replaceAll("'../types/target'","'../../src/types/target'").replaceAll("'./overlapDetection'","'../../src/utils/overlapDetection'")
  .replaceAll("'./issfSpecs'","'../../src/utils/issfSpecs'").replaceAll("'./scoreCompletion'","'../../src/utils/scoreCompletion'");
 await fs.writeFile(root+'/work/residual-placement/'+name,previous);
}
const task=await taskSpace(globalThis.targetScannerTaskSpace??'Target Scanner residual placement 20261021'),p=task.page('p1');console.log({space:task.spaceId});
await p.goto('http://127.0.0.1:5173/');await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
const checks=[],photos=[],rows=[];const assert=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg);};
const click=async s=>{await p.evaluate(s=>{const m=s.match(/^loc=role:button\[name="(.+)"\]$/);const el=m?[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&(b.getAttribute('aria-label')===m[1]||b.textContent?.trim()===m[1])):!s.includes('>>')&&!s.includes(':text-is')?document.querySelector(s):null;el?.scrollIntoView({block:'center'});},s);await p.click(s);};
assert(!await p.evaluate(()=>!!localStorage.getItem('targetscan_gemini_api_key')),'No unrequested Gemini calls');
for(const photo of ['005','006']){
 const name=`KakaoTalk_Photo_2026-10-19-18-36-39 ${photo}.jpeg`;
 const data=await p.evaluate(async({photo,name})=>{
  const {processTargetImage}=await import('/src/utils/visionProcessor.ts');
  const {createVirtualPins,reviewsWithVirtualScores}=await import('/src/utils/virtualPins.ts');
  const {proposeRegions}=await import('/src/utils/regionProposals.ts');
  const old=await import('/work/residual-placement/oldVirtualPins.ts');
  const oldRegions=await import('/work/residual-placement/oldRegionProposals.ts');
  const {completeScore}=await import('/src/utils/scoreCompletion.ts');
  const r=await processTargetImage('/'+encodeURIComponent(name)),regions=r.unresolvedRegions??[],c=r.calibration,shots=r.detectedShots;
  const distance=(a,b)=>(a.x-b.x)**2+(a.y-b.y)**2;
  const coverage=pins=>{
   const all=[...shots.map(s=>({x:s.pixelX,y:s.pixelY})),...pins.map(s=>({x:s.pixelX,y:s.pixelY}))];let area=0,total=0;
   for(const region of regions){const samples=region.holeSamples??[],radius=region.referenceRadiusPx??c.holeRadiusPx;const n=samples.filter(q=>all.some(p=>distance(p,q)<=radius**2)).length;area+=region.areaPx2*n/Math.max(1,samples.length);total+=region.areaPx2;}
   return total?100*area/total:0;
  };
  const cases=[];
  for(const count of [10,15,20,30]){
   const reviews=proposeRegions(regions,shots,c,count,true),pins=createVirtualPins(regions,reviews,c,[],shots);
   const oldReviews=oldRegions.proposeRegions(regions,shots,c,count,true),oldPins=old.createVirtualPins(regions,oldReviews,c);
   const score=completeScore(shots,regions,reviewsWithVirtualScores(reviews,pins,c),count,c,false,null);
   const oldScore=completeScore(shots,regions,old.reviewsWithVirtualScores(oldReviews,oldPins,c),count,c,false,null);
   let objective=true;const occupied=shots.map(s=>({x:s.pixelX,y:s.pixelY}));
   for(const pin of pins){
    const region=regions.find(r=>r.id===pin.regionId),radius=region.referenceRadiusPx??c.holeRadiusPx,r2=radius**2;
    const samples=region.holeSamples,free=samples.filter(q=>!occupied.some(p=>distance(p,q)<=r2));
    const outside=region.pinCandidates.filter(q=>occupied.every(p=>distance(p,q)>r2)),candidates=outside.length?outside:region.pinCandidates;
    const gain=q=>free.filter(p=>distance(p,q)<=r2).length;
    const actual=gain({x:pin.pixelX,y:pin.pixelY}),max=Math.max(...candidates.map(gain));
    if(actual!==max||actual!==pin.newAreaSamples||!candidates.some(q=>q.x===pin.pixelX&&q.y===pin.pixelY))objective=false;
    occupied.push({x:pin.pixelX,y:pin.pixelY});
   }
   cases.push({count,pins,oldPins,reviews,oldReviews,detected:shots.length,estimated:pins.length,imageScore:score.imageScore,virtualScore:score.virtualScore,total:score.proposedTotal,ready:score.estimateReady,oldTotal:oldScore.proposedTotal,oldCoverage:coverage(oldPins),coverage:coverage(pins),baseCoverage:coverage([]),objective});
  }
  return {photo,calibration:c,shots,regions,cases};
 },{photo,name});
 photos.push(data);
 await p.setInputFiles('input[aria-label="앨범 사진 선택"]',[root+'/'+name]);await p.waitForFunction(()=>document.querySelector('button[aria-pressed]')?.disabled===false);
 for(const row of data.cases){
  const tag=`${photo}/${row.count}`;
  assert(row.ready&&row.detected+row.estimated===row.count,`${tag}: selected count preserved`);
  assert(row.objective,`${tag}: each automatic disk maximizes uncovered measured area outside occupied centers when possible`);
  assert(row.coverage+1e-9>=row.oldCoverage,`${tag}: sampled hole coverage does not regress`);
  assert(row.pins.every(pin=>data.regions.some(r=>r.pinCandidates.some(q=>q.x===pin.pixelX&&q.y===pin.pixelY))),`${tag}: every inferred center stays in measured hole interior`);
  await click(`loc=role:button[name="${row.count}발"]`);
  await p.waitForFunction(total=>Number(document.querySelector('[data-estimate-total]')?.dataset.estimateTotal)===total,row.total,{timeout:60000});
  const ui=await p.evaluate(()=>({real:document.querySelectorAll('tbody [data-detail-source="image"]').length,pins:[...document.querySelectorAll('[data-virtual-pin]')].map(b=>({x:Number(b.dataset.x),y:Number(b.dataset.y)})),center:document.querySelector('[data-center-count]').dataset.centerCount,total:Number(document.querySelector('[data-estimate-total]').dataset.estimateTotal)}));
  assert(ui.real===row.detected&&ui.pins.length===row.estimated&&ui.center===String(row.count),`${tag}: image detections, estimate count and whole center match`);
  assert(ui.pins.every((p,i)=>p.x===row.pins[i].pixelX&&p.y===row.pins[i].pixelY),`${tag}: app uses residual placement with detected footprints`);
  rows.push({photo,...Object.fromEntries(Object.entries(row).filter(([k])=>!['pins','oldPins','reviews','oldReviews'].includes(k)))});
 }
}
const pins=()=>p.evaluate(()=>[...document.querySelectorAll('[data-virtual-pin]')].map(e=>({id:e.dataset.virtualPin,x:Number(e.dataset.x),y:Number(e.dataset.y),text:e.textContent})));
// Continue the last 006/30 analysis from the residual coverage verification.
await click('loc=role:button[name="표적 보정"]');await click('loc=role:button[name="위치 수정"]');await click('loc=role:button[name="추정 핀 E1 선택"]');
await p.evaluate(()=>document.querySelector('canvas[aria-label="표적 사진과 탄착점"]').scrollIntoView({block:'center'}));
const touch=await p.evaluate(()=>{const r=document.querySelector('canvas[aria-label="표적 사진과 탄착점"]').getBoundingClientRect(),b=document.querySelector('[data-virtual-pin]');return {start:{x:r.left+Number(b.dataset.x)*r.width/800,y:r.top+Number(b.dataset.y)*r.height/800},end:{x:r.left+10,y:r.top+10}};});
await p.cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await p.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touch.start,id:1}]});await p.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...touch.end,id:1}]});await p.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForFunction(()=>document.querySelector('[data-virtual-pin]').textContent.includes('수정'));
const moved=await pins();assert(moved.length===24&&moved[0].text.includes('수정'),'Touch editing retains selected-count estimates and edited pin');
await click('loc=role:button[name="추정 핀 E2 선택"]');await click('loc=role:button[name="선택 핀 삭제"]');const after=await pins();assert(after.length===23&&after[0].x===moved[0].x&&after[0].y===moved[0].y,'Deletion keeps manually moved pin and removes one estimate');assert(await p.evaluate(()=>document.querySelector('[data-center-count]').dataset.centerCount==='29'&&document.querySelectorAll('tbody [data-detail-source="image"]').length===6),'Whole center follows deletion; detected points unchanged');
await click('loc=role:button[name="수정 완료"]');await click('loc=role:button[name="기록 저장"]');const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('targetscan_sessions'))[0]);assert(saved.unresolvedRegions.every(r=>r.holeSamples?.length)&&saved.shots.length===6,'Saved records preserve native mask samples and original detected shots');
await p.click('nav[aria-label="주요 작업"] button >> nth=2');await p.click(`[data-session-id="${saved.id}"] button:text-is("열기")`);const restored=await pins();assert(JSON.stringify(restored.map(s=>[s.id,s.x,s.y]))===JSON.stringify(after.map(s=>[s.id,s.x,s.y])),'Reload preserves edited placement, deletion and mask-aware automatic positions');
await p.click('nav[aria-label="주요 작업"] button >> nth=2');await p.click(`[data-session-id="${saved.id}"] button[title="기록 삭제"]`);await click('button[aria-label="기록 닫기"]');
for(const width of [320,390,1440]){await p.cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<768});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No overflow at ${width}px`);}
await fs.mkdir(root+'/outputs/residual-placement',{recursive:true});await fs.writeFile(root+'/outputs/residual-placement/results.json',JSON.stringify({checks,rows,photos},null,2));console.log({passed:checks.length,rows});
