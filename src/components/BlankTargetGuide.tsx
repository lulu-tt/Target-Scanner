import React from 'react';
import { ShotPoint } from '../types/target';
import { blankTargetSpread } from '../utils/blankTargetGuide';
export function BlankTargetGuide({ shots }: { shots: ShotPoint[] }) {
  const spread = blankTargetSpread(shots);
  return <section aria-label="백지 표적 가이드" className="surface-card space-y-3 p-4">
    <div><h3 className="font-bold">백지 표적 · 집탄 분포 보기</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">링과 기준 길이가 없어 점수·실제 mm·영점 클릭 수를 계산하지 않습니다.</p></div>
    {spread ? <><div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><div><p className="text-xs text-slate-500">사진 폭 대비 집탄 폭</p><p className="text-xl font-extrabold">{spread.widthPercent.toFixed(1)}%</p></div><div><p className="text-xs text-slate-500">사진 높이 대비 집탄 높이</p><p className="text-xl font-extrabold">{spread.heightPercent.toFixed(1)}%</p></div></div><p className="text-sm font-semibold">{spread.direction}</p><p className="text-xs text-slate-500">감지 핀만 기준으로 계산합니다. 추정 핀은 분포 통계에 포함하지 않습니다.</p></> : <p className="text-sm text-slate-500">분포 비교에는 감지 핀이 2개 이상 필요합니다.</p>}
    <ol className="list-decimal space-y-2 pl-5 text-xs leading-relaxed text-slate-600 dark:text-slate-300"><li>원본 구멍과 핀을 대조하고, 겹친 곳의 추정 발수를 확인하세요.</li><li>다음 기록과 비교할 때 촬영 거리·각도·사진에 담는 범위를 같게 유지하세요. 사진 비율은 촬영 구도가 달라지면 함께 바뀝니다.</li><li>조준한 위치를 사진에 표시하고 자를 함께 촬영해두면, 나중에 조준점 편차와 실제 크기를 대조할 수 있습니다.</li></ol>
    <p className="text-xs text-slate-500">사진만으로 탄착 분포의 원인을 단정하거나 조준기 조정을 권하지 않습니다.</p>
  </section>;
}
