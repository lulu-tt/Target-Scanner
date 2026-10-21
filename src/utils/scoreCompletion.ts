import { RegionScoreReview, ShotPoint, TargetCalibration } from '../types/target';
import { UnresolvedRegion } from './overlapDetection';
import { calculateShotScore } from './issfSpecs';
export function regionScoreRange(r: UnresolvedRegion, c: TargetCalibration) {
  if(c.targetType==='blank')return null;
  // Conservative rectangular envelope for possible centres, including scale/edge uncertainty.
  const pad=2 + (c.holeRadiusPx ?? c.pxPerMm*2.25);
  const l=r.centerX-r.width/2-pad,t=r.centerY-r.height/2-pad;
  const right=r.centerX+r.width/2+pad,b=r.centerY+r.height/2+pad;
  const x=Math.max(l,Math.min(right,c.centerX)),y=Math.max(t,Math.min(b,c.centerY));
  const max=calculateShotScore(x,y,c).score;
  const min=Math.min(...[[l,t],[right,t],[l,b],[right,b]].map(([x,y])=>calculateShotScore(x,y,c).score));
  return {min,max};
}
export function completeScore(shots: ShotPoint[], regions: UnresolvedRegion[], reviews: RegionScoreReview[], expected: number, c: TargetCalibration, acknowledged: boolean, cardTotal: number | null) {
  const valid=reviews.filter(r=>regions.some(p=>p.id===r.regionId&&((r.source!=='auto-area'&&r.source!=='count-conditioned')||!!p.pinCandidates?.length))&&Number.isInteger(r.additionalCount)&&r.additionalCount>0);
  const count=shots.length+valid.reduce((s,r)=>s+r.additionalCount,0);
  const unresolved=expected>0?Math.max(0,expected-count):null;
  const located=shots.reduce((s,p)=>s+p.score,0);
  let min=located,max=located,pending=false,scoresAvailable=true;
  for(const r of valid){
    if(Number.isFinite(r.confirmedTotal) && r.confirmedTotal! >= 0 && r.confirmedTotal! <= r.additionalCount*10.9){min+=r.confirmedTotal!;max+=r.confirmedTotal!;}
    else if(r.confirmedTotal===undefined && Number.isFinite(r.estimatedTotal) && r.estimatedTotal! >= 0 && r.estimatedTotal! <= r.additionalCount*10.9) {
      const range=regionScoreRange(regions.find(p=>p.id===r.regionId)!,c);
      min+=r.additionalCount*(range?.min??0);max+=r.additionalCount*(range?.max??10.9);
      if(!acknowledged)pending=true;
    }
    else {const range=regionScoreRange(regions.find(p=>p.id===r.regionId)!,c);min+=r.additionalCount*(range?.min??0);max+=r.additionalCount*(range?.max??10.9);pending=true;scoresAvailable=false;}
  }
  const proposedTotal=located+valid.reduce((sum,r)=>sum+(Number.isFinite(r.confirmedTotal)&&r.confirmedTotal!>=0&&r.confirmedTotal!<=r.additionalCount*10.9?r.confirmedTotal!:r.confirmedTotal===undefined&&Number.isFinite(r.estimatedTotal)&&r.estimatedTotal!>=0&&r.estimatedTotal!<=r.additionalCount*10.9?r.estimatedTotal!:0),0);
  const hasEstimates=valid.some(r=>r.confirmedTotal===undefined&&r.estimatedTotal!==undefined);
  const override=cardTotal!==null&&Number.isFinite(cardTotal)&&expected>0&&cardTotal>=0&&cardTotal<=expected*10.9;
  const estimateReady=expected>0&&count===expected&&scoresAvailable&&c.targetType==='standard';
  const imageScore=Math.round(located*10)/10,virtualScore=Math.round((proposedTotal-located)*10)/10;
  const complete=acknowledged&&(cardTotal===null||override)&&(override||(expected>0&&count===expected&&!pending&&c.targetType==='standard'&&c.verified===true));
  return {estimateReady,imageScore,virtualScore,count,unresolved,excess:expected>0?Math.max(0,count-expected):0,min:Math.round(min*10)/10,max:Math.round(max*10)/10,pending,complete,hasEstimates,proposedTotal:Math.round(proposedTotal*10)/10,total:override?cardTotal:Math.round(proposedTotal*10)/10,override};
}
