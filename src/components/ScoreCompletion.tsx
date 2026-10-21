import React from 'react';
import { RegionScoreReview, ShotPoint, TargetCalibration } from '../types/target';
import { UnresolvedRegion } from '../utils/overlapDetection';
import { regionLocatedCount } from '../utils/regionProposals';
import { completeScore, regionScoreRange } from '../utils/scoreCompletion';
interface Props { conditioned:boolean; onConditioned:(b:boolean)=>void; shots:ShotPoint[]; regions:UnresolvedRegion[]; reviews:RegionScoreReview[]; calibration:TargetCalibration; expected:number; acknowledged:boolean; cardTotal:number|null; onReviews:(r:RegionScoreReview[])=>void; onAcknowledge:(b:boolean)=>void; onCardTotal:(n:number|null)=>void; }
export function ScoreCompletion(p:Props){
 const result=completeScore(p.shots,p.regions,p.reviews,p.expected,p.calibration,p.acknowledged,p.cardTotal);
 const update=(id:string,patch:Partial<RegionScoreReview>)=>{
   const old=p.reviews.find(r=>r.regionId===id)??{regionId:id,additionalCount:0};
   const n=patch.additionalCount??old.additionalCount;
   const region=p.regions.find(r=>r.id===id);
   const clearedScore=Object.prototype.hasOwnProperty.call(patch,'confirmedTotal')&&patch.confirmedTotal===undefined&&patch.additionalCount===undefined;
   const estimatedTotal=clearedScore||region?.scoreEstimatePerShot===undefined?undefined:Math.round(region.scoreEstimatePerShot*n*10)/10;
   p.onReviews([...p.reviews.filter(r=>r.regionId!==id),{...old,...patch,source:'manual',estimatedTotal}]);p.onAcknowledge(false);
 };
 return <section aria-label="총점 완성" className="surface-card space-y-4 p-4">
  <div><h3 className="font-bold">선택 발수 기준 추정 총점</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">선택한 발수에 맞춰 부족한 탄착을 겹침으로 가정하고 추정 핀으로 채웁니다. 추정 총점은 즉시 표시되며, 틀린 부분만 수정할 수 있습니다. 추정 핀은 구멍 안의 예시 위치이며 실제 감지·집탄 통계에 포함하지 않습니다.</p></div>
  {!result.override && <div aria-label="선택 발수 추정 총점" data-estimate-ready={result.estimateReady} data-estimate-total={result.estimateReady?result.proposedTotal:''} className="rounded-2xl bg-slate-900 p-4 text-white dark:bg-slate-800">
    <p className="text-sm font-bold">{p.expected>0?`${p.expected}발 기준 전체 추정 총점`:'발수 미입력'}</p>
    <p className="mt-2 text-4xl font-black">{result.estimateReady?`${result.proposedTotal.toFixed(1)}점`:p.calibration.targetType==='blank'?'점수 기준 없음':'전체 추정 불가'}</p>
    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-700 pt-3 text-sm"><div><p className="text-xs text-slate-300">감지 ({p.shots.length}발)</p><p className="mt-1 font-bold">{p.calibration.targetType==='blank'?'—':`${result.imageScore.toFixed(1)}점`}</p></div><div><p className="text-xs text-purple-200">추정 ({result.count-p.shots.length}발)</p><p className="mt-1 font-bold text-purple-200">{p.calibration.targetType==='blank'?'—':`${result.virtualScore.toFixed(1)}점`}</p></div></div>
    <p className="mt-3 text-xs leading-relaxed text-slate-300">부족한 발수를 겹침으로 가정한 참고값입니다. 추정 핀은 실제 감지 위치가 아니며, 표적 보정과 추정 위치에 따라 점수가 달라집니다.</p>
    {!result.estimateReady&&p.calibration.targetType!=='blank'&&<p className="mt-2 text-xs text-amber-300">{result.excess>0?'이미지 후보가 선택 발수보다 많습니다. 오검출을 수정하거나 발수를 바꿔주세요.':result.unresolved?'구멍 내부 근거가 부족하거나 수정으로 미배정 발수가 남았습니다. 영역 발수 또는 핀을 확인해주세요.':'일부 점수가 비어 있거나 잘못되었습니다. 추가 점수를 확인해주세요.'}</p>}
  </div>}
  <p className="text-sm font-semibold" role="status">{result.override?`전체 ${p.expected}발 총점 직접 확인 · 좌표 ${p.shots.length}개`:p.expected>0?`${result.count} / ${p.expected}발 배정 · 미배정 ${result.unresolved}발`:'발수를 먼저 선택해주세요'}{result.excess>0?` · ${result.excess}발 초과`:''}</p>
  {p.regions.length>0 && <label className="flex min-h-11 items-start gap-3 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"><input aria-label="부족 발수 겹침 가정" type="checkbox" checked={p.conditioned} onChange={e=>p.onConditioned(e.target.checked)} className="mt-1 h-5 w-5 shrink-0"/><span>부족한 발수는 겹친 구멍 안에 있다고 가정합니다 (기본 켜짐). 남은 발수를 자동 배분해 추정 핀으로 표시합니다. 빗나감·다른 미검출이 있으면 끄거나 발수를 수정하세요.</span></label>}
  {p.regions.map((r,i)=>{const review=p.reviews.find(v=>v.regionId===r.id),n=review?.additionalCount??0,range=regionScoreRange(r,p.calibration);const located=regionLocatedCount(r,p.shots);
   return <fieldset key={r.id} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"><legend className="px-1 text-sm font-bold">영역 {i+1} · 기존 핀 {located}개</legend>
    {n>0&&!r.pinCandidates?.length&&<p className="text-xs text-slate-500">이 기록에는 구멍 내부 마스크가 없어 추정 핀을 표시하지 않습니다. 원본 사진을 다시 분석해주세요.</p>}
    {n>0 && review?.explanation && <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">{review.source==='manual'?'수정값':review.source==='count-conditioned'?'발수 조건부 추정 · 신뢰도 낮음':'면적 기반 자동 추정 · 신뢰도 낮음'} · {review.explanation}{review.countRange && review.source!=='count-conditioned'?` 추가 발수 참고 범위 ${review.countRange[0]}–${review.countRange[1]}발 (통계적 신뢰구간 아님).`:''}</p>}
    <div className="grid grid-cols-2 gap-3"><label className="text-xs">겹친 추가 발수<input aria-label={`영역 ${i+1} 추가 발수`} type="number" inputMode="numeric" min="0" max={p.expected||100} step="1" value={n} onChange={e=>{const v=Number(e.target.value);update(r.id,{additionalCount:Number.isInteger(v)&&v>=0?v:0,confirmedTotal:undefined});}} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-2 text-base"/></label>
    <label className="text-xs">추가 발수 합계 점수<input aria-label={`영역 ${i+1} 확인 점수`} type="number" inputMode="decimal" min="0" max={n*10.9} step="0.1" disabled={!n} value={review?.confirmedTotal??review?.estimatedTotal??''} placeholder="추정 불가" onChange={e=>update(r.id,{confirmedTotal:e.target.value===''?undefined:Number(e.target.value)})} className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-2 text-base disabled:opacity-40"/></label></div>
    {n>0&&review?.estimatedTotal!==undefined&&review.confirmedTotal===undefined&&<p className="text-xs font-semibold text-amber-700">점수 자동 제안 {review.estimatedTotal.toFixed(1)}점 · 추정 핀이 표시된 경우 해당 예시 위치들의 합계이며, 없으면 영역 평균 점수에 따른 추정</p>}
    <p className="text-xs leading-relaxed text-slate-500">{range?`보정된 영역 경계 기준 1발당 ${range.min.toFixed(1)}–${range.max.toFixed(1)}점. ${n}발이면 ${(range.min*n).toFixed(1)}–${(range.max*n).toFixed(1)}점. 범위는 보수적 기하 범위이며 확률 구간이 아닙니다.`:'백지는 링 기준이 없어 점수 범위를 계산하지 않습니다. 별도 채점한 전체 총점을 아래에 기록할 수 있습니다.'}</p>
    {range && review?.confirmedTotal!==undefined && (review.confirmedTotal < range.min*n || review.confirmedTotal > range.max*n) && <p className="text-xs text-amber-700">입력한 점수가 자동 계산 범위를 벗어납니다. 보정과 원본을 다시 확인해주세요.</p>}
    {review?.confirmedTotal!==undefined&&(!Number.isFinite(review.confirmedTotal)||review.confirmedTotal<0||review.confirmedTotal>n*10.9)&&<p className="text-xs text-red-600">0–{(n*10.9).toFixed(1)}점 범위로 입력해주세요.</p>}
   </fieldset>;
  })}
  <details><summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold">별도로 채점한 전체 총점 입력</summary><label className="block text-xs leading-relaxed">전체 총점은 위 핀·영역 점수 합계를 대체합니다. 백지나 채점표의 확인 점수를 기록할 때 사용하세요.<input aria-label="별도 확인 전체 총점" type="number" inputMode="decimal" min="0" max={p.expected*10.9} step="0.1" value={p.cardTotal??''} onChange={e=>{p.onCardTotal(e.target.value===''?null:Number(e.target.value));p.onAcknowledge(false);}} className="mt-2 min-h-11 w-full rounded-lg border bg-transparent px-3 text-base"/></label></details>
  {p.cardTotal!==null&&!result.override&&<p className="text-xs text-red-600">발수를 선택하고 0–{(p.expected*10.9).toFixed(1)}점으로 입력해주세요.</p>}
  {!result.override && <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">자동·수정 제안 합계 {result.proposedTotal.toFixed(1)}점 · {result.complete?'사용자 확인됨':'아직 사용자 확인 전'}{result.unresolved?' (미배정 발수 제외)':''}</p>}
  {!result.override&&<p className="text-sm">배정된 탄착의 참고 점수: {result.min.toFixed(1)}{result.min!==result.max?`–${result.max.toFixed(1)}`:''}점{result.unresolved?' · 미배정 발수 제외':''}</p>}
  {p.calibration.targetType==='standard'&&!p.calibration.verified&&!result.override&&<p className="text-xs text-amber-700">표적 보정에서 링 정렬과 크기를 확인해야 총점을 확정할 수 있습니다.</p>}
  <label className="flex min-h-11 items-center gap-3 text-sm"><input aria-label="발수와 점수 검토 완료" type="checkbox" checked={p.acknowledged} onChange={e=>p.onAcknowledge(e.target.checked)} className="h-5 w-5 shrink-0"/>원본과 발수·점수를 대조했습니다{result.override?' (전체 총점 직접 확인)':''}</label>
  <div data-score-complete={result.complete} className="rounded-xl bg-slate-100 p-4 dark:bg-slate-800"><p className="text-xs font-bold">{result.complete?(result.hasEstimates&&!result.override?'사용자 확인 추정 총점':'사용자 확인 총점'):'원본 대조 확인'}</p><p className="mt-1 text-3xl font-black">{result.complete?`${result.total.toFixed(1)}점`:'검토 전'}</p><p className="mt-2 text-xs text-slate-500">{result.override?'전체 총점을 직접 기록했습니다. 좌표 기반 집탄 통계에는 반영하지 않습니다.':'전체 추정 총점은 위에 먼저 표시합니다. 보정과 원본 대조를 마치면 사용자 확인 기록이 됩니다. 추정 위치의 오차가 남을 수 있습니다.'}</p></div>
 </section>;
}
