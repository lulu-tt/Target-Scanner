import React from 'react';
import { RegionScoreReview, ShotPoint, TargetCalibration } from '../types/target';
import { UnresolvedRegion } from '../utils/overlapDetection';
import { completeScore, regionScoreRange } from '../utils/scoreCompletion';
interface Props { shots:ShotPoint[]; regions:UnresolvedRegion[]; reviews:RegionScoreReview[]; calibration:TargetCalibration; expected:number; acknowledged:boolean; cardTotal:number|null; onReviews:(r:RegionScoreReview[])=>void; onAcknowledge:(b:boolean)=>void; onCardTotal:(n:number|null)=>void; }
export function ScoreCompletion(p:Props){
 const result=completeScore(p.shots,p.regions,p.reviews,p.expected,p.calibration,p.acknowledged,p.cardTotal);
 const update=(id:string,patch:Partial<RegionScoreReview>)=>{const old=p.reviews.find(r=>r.regionId===id)??{regionId:id,additionalCount:0};p.onReviews([...p.reviews.filter(r=>r.regionId!==id),{...old,...patch}]);p.onAcknowledge(false);};
 return <section aria-label="총점 완성" className="surface-card space-y-4 p-4">
  <div><h3 className="font-bold">발수 확인과 총점 완성</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">영역에 이미 표시된 핀은 집계되어 있습니다. 겹쳐서 빠진 추가 발수만 입력하세요. 영역 점수는 추가 발수의 합계이며, 핀이나 집탄 통계를 만들지 않습니다.</p></div>
  <p className="text-sm font-semibold" role="status">{result.override?`전체 ${p.expected}발 총점 직접 확인 · 좌표 ${p.shots.length}개`:p.expected>0?`${result.count} / ${p.expected}발 배정 · 미배정 ${result.unresolved}발`:'발수를 먼저 선택해주세요'}{result.excess>0?` · ${result.excess}발 초과`:''}</p>
  {p.regions.map((r,i)=>{const review=p.reviews.find(v=>v.regionId===r.id),n=review?.additionalCount??0,range=regionScoreRange(r,p.calibration);const located=p.shots.filter(s=>s.evidence?.componentId===r.id || (!s.evidence && Math.abs(s.pixelX-r.centerX)<=r.width/2 && Math.abs(s.pixelY-r.centerY)<=r.height/2)).length;
   return <fieldset key={r.id} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><legend className="px-1 text-sm font-bold">영역 {i+1} · 기존 핀 {located}개</legend>
    <div className="grid grid-cols-2 gap-3"><label className="text-xs">겹친 추가 발수<input aria-label={`영역 ${i+1} 추가 발수`} type="number" inputMode="numeric" min="0" max={p.expected||100} step="1" value={n} onChange={e=>{const v=Number(e.target.value);update(r.id,{additionalCount:Number.isInteger(v)&&v>=0?v:0,confirmedTotal:undefined});}} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-2 text-base"/></label>
    <label className="text-xs">추가 발수 확인 점수<input aria-label={`영역 ${i+1} 확인 점수`} type="number" inputMode="decimal" min="0" max={n*10.9} step="0.1" disabled={!n} value={review?.confirmedTotal??''} placeholder="합계 입력" onChange={e=>update(r.id,{confirmedTotal:e.target.value===''?undefined:Number(e.target.value)})} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-2 text-base disabled:opacity-40"/></label></div>
    <p className="text-xs leading-relaxed text-slate-500">{range?`보정된 영역 경계 기준 1발당 ${range.min.toFixed(1)}–${range.max.toFixed(1)}점. ${n}발이면 ${(range.min*n).toFixed(1)}–${(range.max*n).toFixed(1)}점. 범위는 보수적 기하 범위이며 확률 구간이 아닙니다.`:'백지는 링 기준이 없어 점수 범위를 계산하지 않습니다. 별도 채점한 전체 총점을 아래에 기록할 수 있습니다.'}</p>
    {range && review?.confirmedTotal!==undefined && (review.confirmedTotal < range.min*n || review.confirmedTotal > range.max*n) && <p className="text-xs text-amber-700">입력한 점수가 자동 계산 범위를 벗어납니다. 보정과 원본을 다시 확인해주세요.</p>}
    {review?.confirmedTotal!==undefined&&(!Number.isFinite(review.confirmedTotal)||review.confirmedTotal<0||review.confirmedTotal>n*10.9)&&<p className="text-xs text-red-600">0–{(n*10.9).toFixed(1)}점 범위로 입력해주세요.</p>}
   </fieldset>;
  })}
  <details><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">별도로 채점한 전체 총점 입력</summary><label className="block text-xs leading-relaxed">전체 총점은 위 핀·영역 점수 합계를 대체합니다. 백지나 채점표의 확인 점수를 기록할 때 사용하세요.<input aria-label="별도 확인 전체 총점" type="number" inputMode="decimal" min="0" max={p.expected*10.9} step="0.1" value={p.cardTotal??''} onChange={e=>{p.onCardTotal(e.target.value===''?null:Number(e.target.value));p.onAcknowledge(false);}} className="mt-2 min-h-11 w-full rounded-lg border bg-transparent px-3 text-base"/></label></details>
  {p.cardTotal!==null&&!result.override&&<p className="text-xs text-red-600">발수를 선택하고 0–{(p.expected*10.9).toFixed(1)}점으로 입력해주세요.</p>}
  {!result.override&&<p className="text-sm">배정된 탄착의 참고 점수: {result.min.toFixed(1)}{result.min!==result.max?`–${result.max.toFixed(1)}`:''}점{result.unresolved?' · 미배정 발수 제외':''}</p>}
  {p.calibration.targetType==='standard'&&!p.calibration.verified&&!result.override&&<p className="text-xs text-amber-700">표적 보정에서 링 정렬과 크기를 확인해야 총점을 확정할 수 있습니다.</p>}
  <label className="flex min-h-11 items-center gap-3 text-sm"><input aria-label="발수와 점수 검토 완료" type="checkbox" checked={p.acknowledged} onChange={e=>p.onAcknowledge(e.target.checked)} className="h-5 w-5 shrink-0"/>원본과 발수·점수를 대조했습니다{result.override?' (전체 총점 직접 확인)':''}</label>
  <div data-score-complete={result.complete} className="rounded-xl bg-slate-100 p-4 dark:bg-slate-800"><p className="text-xs font-bold">{result.complete?'사용자 확인 총점':'총점 검토 중'}</p><p className="mt-1 text-3xl font-black">{result.complete?`${result.total.toFixed(1)}점`:'미완료'}</p><p className="mt-2 text-xs text-slate-500">{result.override?'전체 총점을 직접 기록했습니다. 좌표 기반 집탄 통계에는 반영하지 않습니다.':'발수가 일치하고, 보정·추가 점수·검토 확인을 마치면 총점이 완성됩니다. 추정 위치의 오차가 남을 수 있습니다.'}</p></div>
 </section>;
}
