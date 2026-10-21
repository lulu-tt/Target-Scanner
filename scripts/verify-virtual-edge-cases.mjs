const fs=await import('node:fs/promises'),path=await import('node:path'),{fileURLToPath}=await import('node:url');const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const task=await taskSpace(globalThis.targetScannerTaskSpace??'Target Scanner virtual pins 20261021'),p=task.page('p1');const checks=[];const assert=(x,s)=>{if(!x)throw Error(s);checks.push(s);};
const click=async s=>{await p.evaluate(s=>{const m=s.match(/^loc=role:button\[name="(.+)"\]$/),el=m?[...document.querySelectorAll('button')].find(b=>b.getClientRects().length&&(b.getAttribute('aria-label')===m[1]||b.textContent?.trim()===m[1])):!s.includes('>>')&&!s.includes(':text-is')?document.querySelector(s):null;el?.scrollIntoView({block:'center'});},s);await p.click(s);};
const count=()=>p.evaluate(()=>document.querySelectorAll('[data-virtual-pin]').length);
await p.goto('http://127.0.0.1:5173');await p.cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await p.setInputFiles('input[aria-label="앨범 사진 선택"]',[root+'/KakaoTalk_Photo_2026-10-19-18-36-39 006.jpeg']);await p.waitForFunction(()=>document.querySelector('button[aria-pressed]')?.disabled===false);await click('loc=role:button[name="10발"]');await p.waitForFunction(()=>document.querySelectorAll('[data-virtual-pin]').length>0,undefined,{timeout:60000});
await click('loc=role:button[name="분석 결과"]');await click('input[aria-label="미배정 탄착 모두 겹침으로 확인"]');await click('loc=role:button[name="표적 보정"]');await click('loc=role:button[name="위치 수정"]');
await click('loc=role:button[name="가상 핀 V1 선택"]');await click('loc=role:button[name="확대"]');await click('loc=role:button[name="확대"]');await click('loc=role:button[name="확대"]');await click('loc=role:button[name="확대"]');await click('loc=role:button[name="확대"]');await click('loc=role:button[name="확대"]');
await p.evaluate(()=>document.querySelector('canvas[aria-label="표적 사진과 탄착점"]').scrollIntoView({block:'center'}));await p.screenshot({path:root+'/outputs/virtual-pins/zoom-6.png'});await click('loc=role:button[name="확대 초기화"]');
const initial=await count();for(let i=0;i<initial;i++){if(!await p.evaluate(()=>document.querySelector('[data-virtual-pin]')?.getAttribute('aria-pressed')==='true'))await click('loc=role:button[name="가상 핀 V1 선택"]');await click('loc=role:button[name="선택 핀 삭제"]');}
assert(await count()===0,'Deleting all virtual pins leaves zero, without automatic refill');
assert(await p.evaluate(()=>document.querySelector('tbody').rows.length===6),'All virtual deletions leave six real coordinate candidates');
await click('loc=role:button[name="수정 완료"]');await click('loc=role:button[name="분석 결과"]');
assert(await p.evaluate(()=>[...document.querySelectorAll('input[aria-label$="확인 점수"]')].every(e=>e.value===''||Number(e.value)===0)),'Zero-count regions never show a stale positive virtual score');
await click('input[aria-label="미배정 탄착 모두 겹침으로 확인"]');await click('input[aria-label="미배정 탄착 모두 겹침으로 확인"]');assert(await count()===0,'Explicitly deleted counts survive assumption toggles');
await click('loc=role:button[name="기록 저장"]');const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('targetscan_sessions'))[0]);
await p.click('nav[aria-label="주요 작업"] button >> nth=2');await p.click(`[data-session-id="${saved.id}"] button:text-is("열기")`);assert(await count()===0,'All-deleted layout stays deleted after save and load');
await p.click('nav[aria-label="주요 작업"] button >> nth=2');await p.click(`[data-session-id="${saved.id}"] button[title="기록 삭제"]`);await click('button[aria-label="기록 닫기"]');
await fs.writeFile(root+'/outputs/virtual-pins/edge-checks.json',JSON.stringify({checks},null,2));console.log({passed:checks.length,checks});
