// Run using ego-browser nodejs, after ego-browser skill. Never exports the API key.
const fs=await import('node:fs/promises');
const root='/Users/aaa/Documents/ChatGPT/Target Scanner';
const t=await taskSpace(globalThis.targetScannerTaskSpace??'Target Scanner Gemini comparison 20261021'),p=t.page('p1');
if(await p.url()!=='http://127.0.0.1:5173/')await p.goto('http://127.0.0.1:5173/');
const rows=[];
for(const photo of ['005','006']){
 await p.evaluate(photo=>{
  window.__geminiComparisonV3Done=false;
  window.__geminiComparisonV3Job=(async()=>{
   const {processTargetImage}=await import('/src/utils/visionProcessor.ts');
   const {analyzeTargetWithGemini,getStoredGeminiApiKey}=await import('/src/utils/geminiVision.ts');
   const {proposeRegions}=await import('/src/utils/regionProposals.ts');
   const {createVirtualPins,reviewsWithVirtualScores}=await import('/src/utils/virtualPins.ts');
   const {completeScore}=await import('/src/utils/scoreCompletion.ts');
   const name=`KakaoTalk_Photo_2026-10-19-18-36-39 ${photo}.jpeg`;
   const file=new File([await (await fetch('/'+encodeURIComponent(name))).blob()],name,{type:'image/jpeg'});
   const local=await processTargetImage(file);
   const summarize=(result,count)=>{
    const regions=result.unresolvedRegions??[],reviews=proposeRegions(regions,result.detectedShots,result.calibration,count,true);
    const pins=createVirtualPins(regions,reviews,result.calibration,[],result.detectedShots);
    const total=completeScore(result.detectedShots,regions,reviewsWithVirtualScores(reviews,pins,result.calibration),count,result.calibration,false,null);
    return {count,detected:result.detectedShots.filter(s=>s.detectionStatus==='detected').length,estimated:result.detectedShots.filter(s=>s.detectionStatus==='estimated').length,virtual:pins.length,imageScore:total.imageScore,virtualScore:total.virtualScore,total:total.estimateReady?total.proposedTotal:null};
   };
   const row={photo,local:[10,15,20,30].map(n=>summarize(local,n)),localShots:local.detectedShots,calibration:local.calibration,geminiStatus:'missing-key'};
   const key=window.__comparisonApiKey||getStoredGeminiApiKey();
   if(key){
    try{
     const hybrid=await analyzeTargetWithGemini(file,key,{geometry:local});
     row.geminiStatus='completed';row.hybrid=[10,15,20,30].map(n=>summarize(hybrid,n));row.comparison=hybrid.aiComparison;row.hybridShots=hybrid.detectedShots;row.warnings=hybrid.warnings;
    }catch(e){row.geminiStatus='request-failed';row.error=e instanceof Error?e.message:'Gemini request failed';}
   }
   return row;
  })().then(row=>window.__geminiComparisonV3Result=row).catch(()=>window.__geminiComparisonV3Result={photo,geminiStatus:'local-analysis-failed'}).finally(()=>window.__geminiComparisonV3Done=true);
 },photo);
 // Bounded waits; model fallback can require a second 60s window.
 try{await p.waitForFunction(()=>window.__geminiComparisonV3Done,undefined,{timeout:60000});}
 catch{await p.waitForFunction(()=>window.__geminiComparisonV3Done,undefined,{timeout:60000});}
 rows.push(await p.evaluate(()=>window.__geminiComparisonV3Result));
 console.log({photo,status:rows.at(-1).geminiStatus});
}
const data={createdAt:new Date().toISOString(),scope:'Consistency comparison only; no verified per-impact ground truth. Virtual scores remain conditional.',rows};
await fs.mkdir(root+'/outputs/gemini-comparison',{recursive:true});
await fs.writeFile(root+'/outputs/gemini-comparison/results.json',JSON.stringify(data,null,2));
await import('file://'+root+'/scripts/build-gemini-report.mjs?'+Date.now());
console.log({report:'outputs/gemini-comparison/report.html',rows:rows.map(r=>({photo:r.photo,status:r.geminiStatus,local:r.local,hybrid:r.hybrid}))});
