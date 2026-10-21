const fs=await import('node:fs/promises');const root='/Users/aaa/Documents/ChatGPT/Target Scanner';
const t=await taskSpace(globalThis.targetScannerTaskSpace??'Target Scanner estimated MPI 20261021'),p=t.page('p1');console.log({space:t.spaceId});
const checks=[],rows=[];const assert=(v,s)=>{if(!v)throw Error(s);checks.push(s);};
const click=async s=>{await p.evaluate(s=>{const m=s.match(/^loc=role:button\[name="(.+)"\]$/);const e=m?[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&(b.getAttribute('aria-label')===m[1]||b.textContent?.trim()===m[1])):document.querySelector(s);e?.scrollIntoView({block:'center'});},s);await p.click(s);};
const state=()=>p.evaluate(()=>{const c=document.querySelector('[aria-label="추정 탄착중심"]');return {x:Number(c.dataset.centerX),y:Number(c.dataset.centerY),n:Number(c.dataset.centerCount),complete:c.dataset.centerComplete,text:c.textContent,pins:[...document.querySelectorAll('[data-virtual-pin]')].map(b=>({x:Number(b.dataset.x),y:Number(b.dataset.y)}))};});
await p.goto(globalThis.targetScannerBaseUrl??'http://127.0.0.1:5173');await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
if(await p.evaluate(()=>!!localStorage.getItem('targetscan_gemini_api_key')))throw Error('Existing key untouched; skip unintended AI requests');
for(const photo of ['005','006']){
 const name=`KakaoTalk_Photo_2026-10-19-18-36-39 ${photo}.jpeg`;
 // Independent pixel positions from native image analysis; compare exact arithmetic means.
 const actual=await p.evaluate(async name=>(await (await import('/src/utils/visionProcessor.ts')).processTargetImage('/'+encodeURIComponent(name))).detectedShots.map(s=>({x:s.pixelX,y:s.pixelY})),name);
 await p.setInputFiles('input[aria-label="앨범 사진 선택"]',[root+'/'+name]);await p.waitForFunction(()=>document.querySelector('button[aria-pressed]')?.disabled===false);
 for(const count of photo==='005'?[20]:[10,15,20,30]){
  await click(`loc=role:button[name="${count}발"]`);await p.waitForFunction(n=>Number(document.querySelector('[aria-label="추정 탄착중심"]')?.dataset.centerCount)===n,count,{timeout:60000});
  const a=await state(),points=[...actual,...a.pins],x=points.reduce((s,p)=>s+p.x,0)/points.length,y=points.reduce((s,p)=>s+p.y,0)/points.length;
  assert(a.n===count&&a.complete==='true'&&a.text.includes(`${count}발 전체 추정 탄착중심`),`${photo}/${count}: full selected-count estimate clearly labeled`);
  assert(Math.abs(a.x-x)<1e-9&&Math.abs(a.y-y)<1e-9,`${photo}/${count}: exact mean includes image plus virtual pins equally`);
  rows.push({photo,count,x:a.x,y:a.y,virtual:a.pins.length});
 }
}
await click('loc=role:button[name="표적 보정"]');await click('loc=role:button[name="위치 수정"]');await click('loc=role:button[name="추정 핀 E1 선택"]');
const before=await state();await p.evaluate(()=>document.querySelector('canvas[aria-label="표적 사진과 탄착점"]').scrollIntoView({block:'center'}));
const touch=await p.evaluate(()=>{const r=document.querySelector('canvas[aria-label="표적 사진과 탄착점"]').getBoundingClientRect(),b=document.querySelector('[data-virtual-pin]');return {start:{x:r.left+Number(b.dataset.x)*r.width/800,y:r.top+Number(b.dataset.y)*r.height/800},end:{x:r.left+10,y:r.top+10}};});
await p.cdp('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
await p.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touch.start,id:1}]});await p.cdp('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...touch.end,id:1}]});await p.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
await p.waitForFunction(()=>document.querySelector('[data-virtual-pin]').textContent.includes('수정'));
const moved=await state();assert(Math.abs(moved.x-(before.x+(moved.pins.reduce((s,p)=>s+p.x,0)-before.pins.reduce((s,p)=>s+p.x,0))/before.n))<1e-9&&Math.abs(moved.y-(before.y+(moved.pins.reduce((s,p)=>s+p.y,0)-before.pins.reduce((s,p)=>s+p.y,0))/before.n))<1e-9,'Touch move recomputes whole mean');
await click('loc=role:button[name="추정 핀 E2 선택"]');const deleted=moved.pins[1];await click('loc=role:button[name="선택 핀 삭제"]');const after=await state();assert(after.n===29&&after.complete==='false'&&after.text.includes('부분'), 'Deletion displays partial center instead of a 30-shot full estimate');
assert(Math.abs(after.x-(moved.x*30-deleted.x)/29)<1e-9&&Math.abs(after.y-(moved.y*30-deleted.y)/29)<1e-9,'Deletion removes exactly one coordinate from the mean');
assert(await p.evaluate(()=>document.querySelector('tbody').rows.length===6),'Image-only shot statistics stay separate');
await click('loc=role:button[name="수정 완료"]');
for(const width of [320,390,1440]){await p.cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:width<768});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No horizontal overflow at ${width}px`);}
await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await p.evaluate(()=>document.querySelector('[aria-label="추정 탄착중심"]').scrollIntoView({block:'center'}));
await fs.mkdir(root+'/outputs/estimated-mpi',{recursive:true});await p.screenshot({path:root+'/outputs/estimated-mpi/mobile.png'});await fs.writeFile(root+'/outputs/estimated-mpi/results.json',JSON.stringify({checks,rows},null,2));console.log({passed:checks.length,rows});
