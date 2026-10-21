import { RegionScoreReview, TargetCalibration } from '../types/target';
import { UnresolvedRegion } from './overlapDetection';
import { calculateShotScore } from './issfSpecs';
export interface VirtualPin { id:string; regionId:string; pixelX:number; pixelY:number; score:number; moved:boolean; }
export interface VirtualPinEdit { id:string; regionId:string; pixelX:number; pixelY:number; moved?:boolean; }
export const virtualId=(regionId:string,index:number)=>`virtual:${regionId}:${index}`;
export function constrainVirtualPin(region:UnresolvedRegion,x:number,y:number) {
 const points=region.pinCandidates??[];
 if(!points.length)return null;
 return points.reduce((best,p)=>Math.hypot(p.x-x,p.y-y)<Math.hypot(best.x-x,best.y-y)?p:best,points[0]);
}
/** Schematic placements inside the measured hole mask, never detected shot coordinates. */
export function createVirtualPins(regions:UnresolvedRegion[],reviews:RegionScoreReview[],calibration:TargetCalibration,edits:VirtualPinEdit[]=[]) {
 const result:VirtualPin[]=[];
 for(const review of reviews){
  const region=regions.find(r=>r.id===review.regionId),points=region?.pinCandidates??[];
  if(!region||!points.length||!Number.isInteger(review.additionalCount)||review.additionalCount<0||review.additionalCount>100)continue;
  const chosen:{x:number;y:number}[]=[];
  for(let i=0;i<review.additionalCount;i++){
   const id=virtualId(region.id,i),edit=edits.find(e=>e.id===id&&e.regionId===region.id);
   let point=points[Math.floor(points.length/2)];
   if(chosen.length)point=points.reduce((best,p)=>{
    const distance=(p:{x:number;y:number})=>Math.min(...chosen.map(q=>Math.hypot(p.x-q.x,p.y-q.y)));
    return distance(p)>distance(best)?p:best;
   },point);
   if(edit)point=constrainVirtualPin(region,edit.pixelX,edit.pixelY)!;
   chosen.push(point);
   result.push({id,regionId:region.id,pixelX:point.x,pixelY:point.y,score:calculateShotScore(point.x,point.y,calibration).score,moved:edit?.moved??false});
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
