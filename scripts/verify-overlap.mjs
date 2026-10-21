// Start Vite, then execute this file with ego-browser nodejs -e 'await import("file:///absolute/project/scripts/verify-overlap.mjs")'.
const fs=await import('node:fs/promises');
const {fileURLToPath}=await import('node:url');
const path=await import('node:path');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const task=await taskSpace(globalThis.targetScannerTaskSpace ?? 'Target Scanner overlap 20261021');
const page=task.page('p1');await page.goto('http://127.0.0.1:5173');
const files=(await fs.readdir(root)).filter(n=>n.endsWith('.jpeg')).sort();
if(files.length!==6)throw new Error('Expected the six local validation photos');
const photos=[];const checks=[];
for(const [i,name] of files.entries()){
 const r=await page.evaluate(async({name,i})=>{
  const {processTargetImage}=await import('/src/utils/visionProcessor.ts');
  const {summarizeEvidence}=await import('/src/utils/shotEvidence.ts');
  const expected=i===0||i===5?10:20;
  const results=[];
  for(const targetCount of [expected,0,30])results.push(await processTargetImage('/'+encodeURIComponent(name),undefined,{targetCount}));
  const compact=r=>r.detectedShots.map(s=>[s.pixelX,s.pixelY,s.detectionStatus]);
  if(!results.every(r=>JSON.stringify(compact(r))===JSON.stringify(compact(results[0]))))throw new Error('Shot count affected image fitting');
  const r=results[0];
  if(r.detectedShots.some(s=>!Number.isFinite(s.pixelX)||!Number.isFinite(s.pixelY)))throw new Error('Non-finite coordinates');
  if(r.detectedShots.filter(s=>s.detectionStatus==='estimated').some(s=>s.evidence.visibleArcDeg<120))throw new Error('Estimate lacks visible boundary support');
  return {name,expected,summary:summarizeEvidence(r.detectedShots,expected),shots:r.detectedShots,regions:r.unresolvedRegions,calibration:r.calibration,radius:r.holeRadiusPx};
 },{name,i});
 photos.push(r);checks.push(`${name}: same coordinates for expected/free/30; all estimates have >=120° boundary support; coordinates finite`);
 const image=await page.evaluate(async(r)=>{
  const img=new Image();img.src='/'+encodeURIComponent(r.name);await img.decode();
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=880;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#0f172a';ctx.fillRect(0,0,800,880);ctx.fillStyle='white';ctx.font='bold 23px sans-serif';ctx.fillText(`${r.name.slice(-8,-5)} | detected ${r.summary.detected} / estimated ${r.summary.estimated} / unresolved ${r.summary.unresolved}`,16,30);
  ctx.font='14px sans-serif';ctx.fillText('Green: isolated hole | Orange dashed: estimated center | Gray: ambiguous overlap region',16,62);
  const scale=Math.max(800/img.width,800/img.height);ctx.drawImage(img,(800-img.width*scale)/2,80+(800-img.height*scale)/2,img.width*scale,img.height*scale);
  for(const region of r.regions){ctx.save();ctx.strokeStyle='#94a3b8';ctx.setLineDash([7,5]);ctx.lineWidth=2;ctx.strokeRect(region.centerX-region.width/2-5,80+region.centerY-region.height/2-5,region.width+10,region.height+10);ctx.restore();}
  for(const s of r.shots){ctx.save();ctx.strokeStyle=s.detectionStatus==='detected'?'#10b981':'#f59e0b';ctx.lineWidth=2;if(s.detectionStatus==='estimated')ctx.setLineDash([5,3]);ctx.beginPath();ctx.arc(s.pixelX,80+s.pixelY,r.radius??12,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#0f172a';ctx.fillRect(s.pixelX+9,80+s.pixelY-22,27,19);ctx.fillStyle='white';ctx.font='bold 14px sans-serif';ctx.fillText(String(s.shotNumber),s.pixelX+12,80+s.pixelY-7);ctx.restore();}
  return canvas.toDataURL('image/jpeg',.92).split(',')[1];
 },r);
 await fs.mkdir(path.join(root,'outputs/overlap'),{recursive:true});await fs.writeFile(path.join(root,`outputs/overlap/photo-${i+1}.jpg`),Buffer.from(image,'base64'));
}
await fs.writeFile(path.join(root,'outputs/overlap/results.json'),JSON.stringify({photos,checks},null,2));
console.log({passed:checks.length,results:photos.map(p=>({photo:p.name.slice(-8,-5),...p.summary,regions:p.regions.length,radius:p.radius}))});
