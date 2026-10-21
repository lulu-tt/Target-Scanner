import { RegionScoreReview, TargetCalibration } from '../types/target';
import { UnresolvedRegion } from './overlapDetection';
import { calculateShotScore } from './issfSpecs';
export interface VirtualPin { id:string; regionId:string; pixelX:number; pixelY:number; score:number; moved:boolean; placement?:'residual'|'overlap'|'manual'; newAreaSamples?:number; }
export interface VirtualPinEdit { id:string; regionId:string; pixelX:number; pixelY:number; moved?:boolean; }
export const virtualId=(regionId:string,index:number)=>`virtual:${regionId}:${index}`;
export function constrainVirtualPin(region:UnresolvedRegion,x:number,y:number) {
 const points=region.pinCandidates??[];
 if(!points.length)return null;
 return points.reduce((best,p)=>Math.hypot(p.x-x,p.y-y)<Math.hypot(best.x-x,best.y-y)?p:best,points[0]);
}
/** Schematic placements inside the measured hole mask, never detected shot coordinates. */
export function createVirtualPins(regions:UnresolvedRegion[],reviews:RegionScoreReview[],calibration:TargetCalibration,edits:VirtualPinEdit[]=[],detectedPositions:{pixelX:number;pixelY:number}[]=[]) {
 const result:VirtualPin[]=[];
 const distance2=(a:{x:number;y:number},b:{x:number;y:number})=>(a.x-b.x)**2+(a.y-b.y)**2;
 // Reserve all user placements first, including edited slots later in the sequence.
 const fixed=new Map<string,{x:number;y:number}>();
 for(const review of reviews){
  const region=regions.find(r=>r.id===review.regionId);
  if(!region||!Number.isInteger(review.additionalCount)||review.additionalCount<0||review.additionalCount>100)continue;
  for(let i=0;i<review.additionalCount;i++){
   const id=virtualId(region.id,i),edit=edits.find(e=>e.id===id&&e.regionId===region.id);
   if(edit){const point=constrainVirtualPin(region,edit.pixelX,edit.pixelY);if(point)fixed.set(id,point);}
  }
 }
 const occupied=[...detectedPositions.map(p=>({x:p.pixelX,y:p.pixelY})),...fixed.values()];
 for(const review of reviews){
  const region=regions.find(r=>r.id===review.regionId),points=region?.pinCandidates??[];
  if(!region||!points.length||!Number.isInteger(review.additionalCount)||review.additionalCount<0||review.additionalCount>100)continue;
  const samples=region.holeSamples?.length?region.holeSamples:points;
  const radius=region.referenceRadiusPx??calibration.holeRadiusPx??calibration.pxPerMm*2.25,radius2=radius**2;
  const covered=new Uint8Array(samples.length);
  samples.forEach((p,i)=>{if(occupied.some(q=>distance2(p,q)<=radius2))covered[i]=1;});
  // Precompute measured mask cells covered by each permissible center.
  const footprints=points.map(p=>{
   const indices:number[]=[];
   for(let k=0;k<samples.length;k++)if(distance2(p,samples[k])<=radius2)indices.push(k);
   return indices;
  });
  for(let i=0;i<review.additionalCount;i++){
   const id=virtualId(region.id,i),edit=edits.find(e=>e.id===id&&e.regionId===region.id);
   let point=fixed.get(id),gain=0,placement:VirtualPin['placement']='manual';
   if(!point){
    // Prefer centers outside existing impact disks, then maximize uncovered hole area.
    const outside=points.map((p,j)=>occupied.every(q=>distance2(p,q)>radius2)?j:-1).filter(j=>j>=0);
    const candidates=outside.length?outside:points.map((_,j)=>j);
    let best=candidates[0],bestGain=-1,bestSeparation=-1;
    for(const j of candidates){
     const area=footprints[j].reduce((sum,k)=>sum+(covered[k]?0:1),0);
     const separation=occupied.length?Math.min(...occupied.map(q=>distance2(points[j],q))):0;
     if(area>bestGain||(area===bestGain&&separation>bestSeparation)){best=j;bestGain=area;bestSeparation=separation;}
    }
    point=points[best];gain=bestGain;placement=gain>0?'residual':'overlap';
    for(const k of footprints[best])covered[k]=1;
    occupied.push(point);
   }
   result.push({id,regionId:region.id,pixelX:point.x,pixelY:point.y,score:calculateShotScore(point.x,point.y,calibration).score,moved:edit?.moved??false,placement,newAreaSamples:gain});
  }
 }
 return result;
}
export function reviewsWithVirtualScores(reviews:RegionScoreReview[],pins:VirtualPin[],c:TargetCalibration) {
 return reviews.map(r=>{
  const group=pins.filter(p=>p.regionId===r.regionId);
  return group.length===r.additionalCount&&group.length&&c.targetType==='standard'?{...r,estimatedTotal:Math.round(group.reduce((sum,p)=>sum+p.score,0)*10)/10}:r;
 });
}
