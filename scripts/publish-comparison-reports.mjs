import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Publish only reviewed HTML and linked screenshots. Scratch JSON and source photos stay local.
const root=process.cwd(),dest=path.join(root,'public/reports');
const reports=[
 ['six-placement-comparison','001~006 배치 전후 비교','6장 전체의 핀 위치, 감지·추정 소계와 총점을 비교합니다.',false],
 ['placement-refinement','9276·9277 추정 핀 배치 개선','감지 핀과 거의 겹치던 추정 핀의 이동과 점수 변화를 확인합니다.',false],
 ['005-center-audit','005 · 165.0→164.8점 원인','핀 #3·#7의 중심 이동과 원본 링 경계를 확대 대조합니다.',false],
 ['9276-audit','9276 · 15발 상세 검증','이전 배치에서 감지 6개·추정 9개의 핀별 점수와 링 경계를 검토한 기록입니다.',true],
 ['9277-audit','9277 · 수기 84점과 추정 83점','경계에 가까운 #3·E3과 원본을 대조한 기록입니다.',true],
 ['reliability','9276·9277 감지 오류 수정 전후','검은 종이를 구멍으로 오인하던 감지 오류의 수정 기록입니다.',true],
];
await fs.mkdir(path.join(dest,'assets'),{recursive:true});
const files=new Map();
function jpegWithoutPrivateMetadata(buffer){
 if(buffer[0]!==255||buffer[1]!==216)return buffer;
 let cursor=2,orientation=1;const chunks=[buffer.subarray(0,2)];
 while(cursor<buffer.length){
  if(buffer[cursor]!==255)throw Error('Invalid JPEG marker');
  const start=cursor;while(buffer[cursor]===255)cursor++;
  const marker=buffer[cursor++];
  if(marker===0xda||marker===0xd9){chunks.push(buffer.subarray(start));break;}
  if(marker===1||(marker>=0xd0&&marker<=0xd7)){chunks.push(buffer.subarray(start,cursor));continue;}
  const len=buffer.readUInt16BE(cursor),end=cursor+len;
  if(len<2||end>buffer.length)throw Error('Invalid JPEG segment');
  if(marker===0xe1&&buffer.subarray(cursor+2,cursor+8).toString()==='Exif\0\0'){
   const t=buffer.subarray(cursor+8,end),le=t.subarray(0,2).toString()==='II';
   const u16=i=>le?t.readUInt16LE(i):t.readUInt16BE(i),u32=i=>le?t.readUInt32LE(i):t.readUInt32BE(i);
   if(t.length>=8){const off=u32(4);if(off+2<=t.length)for(let i=0;i<u16(off);i++){const p=off+2+i*12;if(p+12>t.length)break;if(u16(p)===0x112&&u16(p+2)===3&&u32(p+4)===1){const value=u16(p+8);if(value>=1&&value<=8)orientation=value;}}}
  }
  if(marker!==0xe1&&marker!==0xed&&marker!==0xfe)chunks.push(buffer.subarray(start,end));
  cursor=end;
 }
 // Keep orientation only, so the original compressed pixels remain correctly oriented.
 if(orientation!==1){const exif=Buffer.alloc(36);exif[0]=255;exif[1]=225;exif.writeUInt16BE(34,2);exif.write('Exif\0\0',4,'binary');exif.write('II',10);exif.writeUInt16LE(42,12);exif.writeUInt32LE(8,14);exif.writeUInt16LE(1,18);exif.writeUInt16LE(0x112,20);exif.writeUInt16LE(3,22);exif.writeUInt32LE(1,24);exif.writeUInt16LE(orientation,28);chunks.splice(1,0,exif);}
 return Buffer.concat(chunks);
}
async function asset(data,mime){const bytes=mime==='image/jpeg'?jpegWithoutPrivateMetadata(data):data,hash=createHash('sha256').update(bytes).digest('hex').slice(0,20),ext=mime==='image/jpeg'?'jpg':'png',name=hash+'.'+ext;await fs.writeFile(path.join(dest,'assets',name),bytes);files.set('assets/'+name,bytes.length);return '../assets/'+name;}
for(const [id,,,archive]of reports){
 const source=path.join(root,'outputs',id),target=path.join(dest,id);await fs.mkdir(target,{recursive:true});let html=await fs.readFile(path.join(source,'report.html'),'utf8');
 const embedded=[...new Set(html.match(/data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+/g)??[])];
 for(const uri of embedded){const comma=uri.indexOf(','),mime=uri.slice(5,uri.indexOf(';')),ref=await asset(Buffer.from(uri.slice(comma+1),'base64'),mime);html=html.split(uri).join(ref);}
 const links=[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m=>m[1]);
 for(const link of new Set(links)){
  if(/^(?:https?:|#|data:)/.test(link)||!link.endsWith('.png'))continue;
  const file=path.resolve(source,link);if(!file.startsWith(path.join(root,'outputs')+path.sep))throw Error('Outside report source');
  const ref=await asset(await fs.readFile(file),'image/png');html=html.split('"'+link+'"').join('"'+ref+'"');
 }
 const nav=`<nav aria-label="보고서 탐색" style="display:flex;gap:16px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid #ccd4de;margin-bottom:20px"><a href="../index.html">← 보고서 목록</a><a href="/">표적 분석 앱</a></nav><p style="font-size:13px;color:#536174">2026-10-22 공개한 검증 자료 · ${archive?'이전 배치의 검증 기록입니다. 최신 결과는 보고서 목록의 최신 비교에서 확인하세요.':'저장된 사진 분석의 비교 기록입니다. 실제 발사 중심·점수의 확정값은 아닙니다.'}</p>`;
 html=html.replace('<h1>',nav+'<h1>');
 if(/data:image|127\.0\.0\.1|localhost|AIza[A-Za-z0-9_-]{20}/.test(html))throw Error('Unresolved inline asset/local address/credential in '+id);
 await fs.writeFile(path.join(target,'report.html'),html);files.set(id+'/report.html',Buffer.byteLength(html));
}
const cards=archive=>reports.filter(r=>r[3]===archive).map(([id,title,description])=>`<a class="card" href="${id}/report.html"><strong>${title}</strong><span>${description}</span><b>보고서 열기 →</b></a>`).join('');
await fs.writeFile(path.join(dest,'index.html'),`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="TargetScan 사진별 탄착 감지·추정 핀·점수 비교 보고서"><title>TargetScan · 사진별 검증 보고서</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:#17243a;font:16px/1.65 system-ui}main{max-width:1000px;margin:auto;padding:24px 18px 60px}header{padding:22px 0}h1{font-size:clamp(28px,5vw,40px);line-height:1.25;margin:12px 0}h2{font-size:20px;margin-top:32px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:16px}.card{display:flex;flex-direction:column;gap:12px;padding:22px;background:white;border:1px solid #dce3eb;border-radius:18px;text-decoration:none;color:inherit;min-height:200px}.card strong{font-size:19px}.card span{color:#536174;flex:1}.card b,a{color:#00765a}.card:focus-visible,.card:hover{outline:2px solid #008262;outline-offset:2px}.muted{font-size:14px;color:#536174}footer{margin-top:32px;border-top:1px solid #dce3eb;padding-top:20px}</style></head><body><main><header><a href="/">← 표적 분석 앱</a><h1>사진별 검증 보고서</h1><p>원본과 핀 위치, 감지·추정 소계, 전체 점수의 변화를 비교합니다.</p><p class="muted">공개일 2026-10-22 · 아래 자료는 각 검증 시점의 기록입니다.</p></header><h2>최신 비교</h2><div class="grid">${cards(false)}</div><h2>이전 검증 기록</h2><div class="grid">${cards(true)}</div><footer class="muted">점수와 겹침 위치는 사진에 따른 추정입니다. 각 보고서의 비교 조건과 남은 한계를 함께 확인하세요.</footer></main></body></html>`);
// Check every local link and image from the exported package.
for(const relative of [...files.keys()].filter(f=>f.endsWith('.html')).concat('index.html')){const full=path.join(dest,relative),html=await fs.readFile(full,'utf8');for(const [,url]of html.matchAll(/(?:href|src)="([^"]+)"/g)){if(/^(?:https?:|#|data:|\/)/.test(url))continue;const resolved=path.resolve(path.dirname(full),url.split('#')[0]);if(!resolved.startsWith(dest+path.sep))throw Error('Escaping link '+url);await fs.access(resolved);}}
console.log({reports:reports.length,assets:files.size-reports.length,assetBytes:[...files.values()].reduce((s,n)=>s+n,0),destination:'public/reports'});
