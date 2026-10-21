const fs=await import('node:fs/promises'),root='/Users/aaa/Documents/ChatGPT/Target Scanner';
const t=await taskSpace(globalThis.targetScannerTaskSpace),p=t.page('p1'),checks=[],rows=[];
const assert=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg);};
await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await p.goto('http://127.0.0.1:5173/');
assert(!await p.evaluate(()=>!!localStorage.getItem('targetscan_gemini_api_key')),'No unintended Gemini requests');
const click=async s=>{await p.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),s);await p.click(s);};
await fs.mkdir(root+'/outputs/ring-score-check',{recursive:true});
for(const photo of ['005','006']){
 for(const count of [10,15,20,30]){
  await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await p.goto('http://127.0.0.1:5173/');
  await p.setInputFiles('input[aria-label="앨범 사진 선택"]',[root+`/KakaoTalk_Photo_2026-10-19-18-36-39 ${photo}.jpeg`]);
  await p.waitForFunction(()=>document.querySelector('button[aria-pressed]')?.disabled===false);
  await p.evaluate(n=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===n+'발')?.scrollIntoView({block:'center'}),count);
  await p.click(`loc=role:button[name="${count}발"]`);
  await p.waitForFunction(n=>document.querySelectorAll('tr[data-detail-id]').length===n&&document.querySelector('[data-estimate-ready="true"]'),count,{timeout:60000});
  const a=await p.evaluate(()=>{const all=[...document.querySelectorAll('tr[data-detail-id]')].map(e=>({id:e.dataset.detailId,source:e.dataset.detailSource,score:Number(e.dataset.detailScore),text:e.textContent}));return {rows:all,total:Number(document.querySelector('[data-estimate-total]').dataset.estimateTotal),breakdown:Number(document.querySelector('[data-breakdown-total]').dataset.breakdownTotal),labels:document.querySelectorAll('[data-score-label]').length};});
  assert(a.rows.length===count&&a.labels===count,`${photo}/${count}: every pin has one score row and graphic label`);
  assert(Math.round(a.rows.reduce((s,r)=>s+r.score,0)*10)/10===a.total&&a.total===a.breakdown,`${photo}/${count}: detail, subtotals and whole total agree`);
  assert(a.rows.every(r=>r.score===0||r.score>=1),`${photo}/${count}: no 0.x miss score`);
  for(const width of [320,390,1440]){await p.cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${photo}/${count}: ${width}px no page overflow`);}
  if(count===(photo==='005'?20:10)){
   await p.evaluate(()=>document.querySelector('section[aria-label="원본과 핀별 점수"]').scrollIntoView({block:'start'}));
   await p.screenshot({path:root+`/outputs/ring-score-check/${photo}-desktop.png`});
   await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});
   await click('nav[aria-label="주요 작업"] button:nth-child(2)');
   await p.evaluate(()=>document.querySelector('section[aria-label="원본과 핀별 점수"]').scrollIntoView({block:'start'}));
   await p.screenshot({path:root+`/outputs/ring-score-check/${photo}-mobile.png`});
   await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='원본')?.scrollIntoView({block:'center'}));await p.click('loc=role:button[name="원본"]');assert(await p.evaluate(()=>document.querySelectorAll('[data-score-label]').length===0),'Original toggle removes every pin overlay');
   await p.click('loc=role:button[name="핀·점수"]');assert(await p.evaluate(()=>document.querySelectorAll('[data-score-label]').length>0),'Annotated toggle restores score labels');
   const id=a.rows.find(r=>r.source==='estimate').id;await click(`tr[data-detail-id="${id}"]`);
   assert(await p.evaluate(id=>document.querySelector(`[data-virtual-pin="${id}"]`)?.getAttribute('aria-pressed')==='true',id),'Selecting estimate score row selects editable canvas pin');
  }
  rows.push({photo,count,detected:a.rows.filter(r=>r.source==='image').length,estimated:a.rows.filter(r=>r.source==='estimate').length,imageScore:Math.round(a.rows.filter(r=>r.source==='image').reduce((s,r)=>s+r.score,0)*10)/10,total:a.total});
 }
}
await fs.writeFile(root+'/outputs/ring-score-check/results.json',JSON.stringify({checks,rows},null,2));console.log({passed:checks.length,rows});
