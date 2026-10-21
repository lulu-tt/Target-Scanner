// Mock transport integration only. This script does not measure Gemini accuracy.
const fs=await import('node:fs/promises');
const root='/Users/aaa/Documents/ChatGPT/Target Scanner';
const t=await taskSpace(globalThis.targetScannerTaskSpace??'Target Scanner Gemini comparison 20261021'),p=t.page('p1');
await p.goto('http://127.0.0.1:5173/');await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
const checks=[];const assert=(ok,msg)=>{if(!ok)throw Error(msg);checks.push(msg);};
const click=async s=>{await p.evaluate(s=>document.querySelector(s)?.scrollIntoView({block:'center'}),s);await p.click(s);};
if(await p.evaluate(()=>!!localStorage.getItem('targetscan_gemini_api_key')))throw Error('Existing real API key untouched: skip mock settings test');
await p.evaluate(()=>{
 window.__originalTestFetch=window.fetch;window.__testRequests=[];
 window.fetch=async(url,options)=>{
  if(!String(url).startsWith('https://generativelanguage.googleapis.com/')&&!String(url).startsWith('/api/gemini/'))return window.__originalTestFetch(url,options);
  const body=JSON.parse(options.body),part=body.contents[0].parts.find(p=>p.inline_data);
  const img=new Image();img.src='data:image/jpeg;base64,'+part.inline_data.data;await img.decode();
  window.__testRequests.push({width:img.width,height:img.height,keyInUrl:String(url).includes('key='),schema:!!body.generationConfig.response_schema,quota:/User-reported|10 shots|20 shots/.test(body.contents[0].parts[0].text)});
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"shots":[]}'}]}}]}),{status:200});
 };
});
try{
 await click('button[aria-label="분석 설정"]');await p.fill('#gemini-api-key','test-only-not-a-real-key');
 await p.click('loc=role:button[name="설정 저장"]');
 await p.setInputFiles('input[aria-label="앨범 사진 선택"]',[root+'/KakaoTalk_Photo_2026-10-19-18-36-39 006.jpeg']);
 await p.waitForFunction(()=>document.querySelector('button[aria-pressed]')?.disabled===false);
 await p.click('loc=role:button[name="10발"]');
 await p.waitForFunction(()=>document.body.textContent.includes('Gemini 원본 표적 영역'),undefined,{timeout:60000});
 const state=await p.evaluate(()=>({text:document.body.textContent,rows:document.querySelector('tbody')?.rows.length,virtual:document.querySelectorAll('[data-virtual-pin]').length,total:document.querySelector('[aria-label="선택 발수 추정 총점"]')?.dataset.estimateTotal,request:window.__testRequests[0]}));
 assert(state.rows===6&&state.virtual===4,'Empty AI response preserves six native positions and four virtual pins');
 assert(Number(state.total)===83.0,'Same calibration and selected-count scoring preserve 83.0 estimate');
 assert(state.text.includes('다중 링 4개 적합')&&state.text.includes('원본 3000'),'Native ring fitting and source metadata preserved');
 assert(state.request.width>800&&state.request.height>800&&state.request.width<=2048,'AI input uses source-resolution target ROI rather than 800px preview');
 assert(!state.request.keyInUrl&&state.request.schema&&!state.request.quota,'Key excluded from URL; JSON schema enforced; no requested shot quota');
 assert(state.text.includes('기존 6개 보존')&&state.text.includes('AI 일치는 정확도 검증이 아닙니다'),'UI discloses fusion and avoids accuracy claims');
 await p.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='15발')?.scrollIntoView({block:'center'}));
 await p.click('loc=role:button[name="15발"]');
 await p.waitForFunction(()=>Number(document.querySelector('[aria-label="선택 발수 추정 총점"]')?.dataset.estimateTotal)===121.6,undefined,{timeout:60000});
 assert(await p.evaluate(()=>window.__testRequests.length===1&&document.querySelector('tbody')?.rows.length===6),'Changing selected count reuses AI analysis without another request or changed image positions');
 await fs.mkdir(root+'/outputs/gemini-comparison',{recursive:true});
 await fs.writeFile(root+'/outputs/gemini-comparison/integration-checks.json',JSON.stringify({kind:'Mock transport, not Gemini accuracy',checks,request:state.request},null,2));
 console.log({passed:checks.length,request:state.request});
}finally{
 await click('button[aria-label="분석 설정"]');await p.fill('#gemini-api-key','');await p.click('loc=role:button[name="설정 저장"]');
 await p.evaluate(()=>{window.fetch=window.__originalTestFetch;delete window.__originalTestFetch;delete window.__testRequests;});
}
