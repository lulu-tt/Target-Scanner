const fs=await import('node:fs/promises'),path=await import('node:path');
const {fileURLToPath}=await import('node:url');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const t=await taskSpace(globalThis.targetScannerTaskSpace??'Target Scanner native scoring 20261021'),p=t.page('p1');await p.goto('http://127.0.0.1:5173');await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
const click=async s=>{await p.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),s);await p.click(s);};
if(await p.evaluate(()=>!!localStorage.getItem('targetscan_gemini_api_key')))throw Error('Test requires an empty API key; existing key untouched');
await p.evaluate(()=>{window.__originalTestFetch=window.fetch;window.fetch=async(url,options)=>String(url).startsWith('https://generativelanguage.googleapis.com/')?new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({targetType:'standard',centerX:500,centerY:500,blackRadius:120,shots:[{x:500,y:500},{x:510,y:520}]})}]}}]}),{status:200}):window.__originalTestFetch(url,options);});
try{
 await click('button[aria-label="분석 설정"]');await p.fill('#gemini-api-key','test-only-not-a-real-key');
 await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='설정 저장').scrollIntoView({block:'center'}));await p.click('loc=role:button[name="설정 저장"]');
 await p.setInputFiles('input[aria-label="앨범 사진 선택"]',[root+'/KakaoTalk_Photo_2026-10-19-18-36-39 006.jpeg']);
 await p.waitForFunction(()=>document.querySelector('button[aria-pressed]')?.disabled===false);await p.click('loc=role:button[name="10발"]');
 await p.waitForFunction(()=>document.querySelector('tbody')?.rows.length===2&&document.body.textContent.includes('AI의 위치 제안은 800px'),undefined,{timeout:60000});
 const ok=await p.evaluate(()=>document.body.textContent.includes('다중 링 4개 적합')&&document.body.textContent.includes('영역 1')&&document.body.textContent.includes('원본 3000'));
 if(!ok)throw Error('AI must preserve native geometry and review regions');console.log({passed:'Mocked AI suggestions retain native ring calibration, original ROI metadata and review regions'});
}finally{
 await click('button[aria-label="분석 설정"]');await p.fill('#gemini-api-key','');
 await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='설정 저장').scrollIntoView({block:'center'}));await p.click('loc=role:button[name="설정 저장"]');
 await p.evaluate(()=>{window.fetch=window.__originalTestFetch;delete window.__originalTestFetch;});
}
