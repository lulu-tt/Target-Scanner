import { RegionScoreReview, ShotPoint, TargetCalibration } from '../types/target';
import { UnresolvedRegion } from './overlapDetection';
import { regionScoreRange } from './scoreCompletion';
export function regionLocatedCount(r:UnresolvedRegion,shots:ShotPoint[]) {
  return shots.filter(s=>s.evidence?.componentId===r.id||(!s.evidence&&Math.abs(s.pixelX-r.centerX)<=r.width/2&&Math.abs(s.pixelY-r.centerY)<=r.height/2)).length;
}
/** Area-based heuristic, not a trained probability model. No new shot coordinates. */
export function proposeRegions(regions:UnresolvedRegion[],shots:ShotPoint[],c:TargetCalibration,expected:number,conditioned=false):RegionScoreReview[] {
 const remaining=expected>0?Math.max(0,expected-shots.length):Infinity;

 const eligible=regions.filter(r=>Number.isFinite(r.areaPx2)&&Number.isFinite(r.referenceRadiusPx)&&r.areaPx2!>0&&r.referenceRadiusPx!>0);
 const proposals=eligible.map(r=>{
  const equivalent=r.areaPx2!/(Math.PI*r.referenceRadiusPx!**2),located=regionLocatedCount(r,shots);
  // 70% effective visible area is a deliberately explicit overlap prior, not measured accuracy.
  const lower=Math.max(0,Math.floor(equivalent*.85)-located),upper=Math.max(lower,Math.ceil(equivalent/.45)-located);
  const estimate=equivalent<1.5&&located<=1?0:Math.max(lower,Math.round(equivalent/.7)-located);
  const count=estimate;
  return {regionId:r.id,additionalCount:count,source:'auto-area' as RegionScoreReview['source'],countRange:[lower,upper] as [number,number],explanation:`구멍 면적/단일 탄흔 면적 ${equivalent.toFixed(1)}배, 기존 핀 ${located}개. 평균 가시면적 70%를 가정한 낮은 신뢰도의 발수 제안입니다.`};
 });
 const proposedCount=proposals.reduce((sum,p)=>sum+p.additionalCount,0);
 if(Number.isFinite(remaining)&&proposedCount>remaining){
  const raw=proposals.map(p=>p.additionalCount*remaining/proposedCount),counts=raw.map(Math.floor);
  let left=remaining-counts.reduce((s,n)=>s+n,0);
  for(const {i} of raw.map((v,i)=>({i,f:v-counts[i]})).sort((a,b)=>b.f-a.f)){if(!left)break;counts[i]++;left--;}
  proposals.forEach((p,i)=>{p.additionalCount=counts[i];});
 }
 if(conditioned&&Number.isFinite(remaining)&&remaining>0&&eligible.length){
  // User explicitly confirms all unlocated shots belong to these regions. Allocate by area.
  const weights=eligible.map(r=>r.areaPx2!);const total=weights.reduce((s,n)=>s+n,0);
  const raw=weights.map(w=>remaining*w/total),counts=raw.map(Math.floor);
  let left=remaining-counts.reduce((s,n)=>s+n,0);
  const order=raw.map((v,i)=>({i,f:v-counts[i]})).sort((a,b)=>b.f-a.f);
  for(const item of order){if(!left)break;counts[item.i]++;left--;}
  proposals.forEach((p,i)=>{p.additionalCount=counts[i];p.source='count-conditioned';p.explanation='모든 미배정 탄착이 표시된 겹침 영역 안에 있다는 사용자 확인을 전제로, 남은 발수를 영역 면적 비율로 배분했습니다. 사진에서 직접 센 발수가 아닙니다.';});
 }
 return proposals.map(p=>{
  const region=eligible.find(r=>r.id===p.regionId)!;
  const range=regionScoreRange(region,c);
  const average=region.scoreEstimatePerShot;
  const estimatedTotal=range&&Number.isFinite(average)?Math.round(p.additionalCount*Math.max(range.min,Math.min(range.max,average!))*10)/10:undefined;
  return {...p,estimatedTotal};
 });
}
export function mergeRegionReviews(proposals:RegionScoreReview[], edits:RegionScoreReview[]) {
 const byId=new Map(proposals.map(r=>[r.regionId,r]));
 for(const edit of edits)if(edit.source!=='auto-area'&&edit.source!=='count-conditioned')byId.set(edit.regionId,edit);
 return [...byId.values()];
}
