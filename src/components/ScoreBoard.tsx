import { UnresolvedRegion } from '../utils/overlapDetection';
import { summarizeDisplayEvidence } from '../utils/shotEvidence';
/**
 * [영자 실장의 모던 스코어보드 & 사수 분석 패널]
 * 작성자: 디자인 실장 영자 & 코다리 부장
 * 의도: 모바일에서도 시원하게 읽히는 대형 디스플레이 타이포그래피(48px 행 높이)와
 *       라이트/다크 듀얼 테마 지원
 */

import React from 'react';
import { ScoreBreakdown } from './ScoreBreakdown';
import { VirtualPin } from '../utils/virtualPins';
import { ShotPoint, GroupingStats, TargetCalibration } from '../types/target';
import { getSightAdjustmentGuide } from '../utils/issfSpecs';
import { Target, Compass, Award, Sliders } from 'lucide-react';

interface ScoreBoardProps {
  imageUrl: string;
  shots: ShotPoint[];
  virtualPins: VirtualPin[];
  calibration: TargetCalibration;
  unresolvedRegions: UnresolvedRegion[];
  stats: GroupingStats;
  targetCount: number;
  analysisWarnings: string[];
  selectedShotId: string | null;
  onSelectShot: (id: string | null) => void;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  shots,
  imageUrl,
  virtualPins,
  calibration,
  unresolvedRegions,
  stats,
  targetCount,
  analysisWarnings,
  selectedShotId,
  onSelectShot,
}) => {
  const evidence = summarizeDisplayEvidence(shots, virtualPins.length, targetCount);
  const sightGuide = getSightAdjustmentGuide(stats.mpiX_mm, stats.mpiY_mm);

  // 최고점 / 최저점 탄환
  const sortedByScore = [...shots].sort((a, b) => b.score - a.score);
  const bestShot = sortedByScore[0];
  const lowestShot = sortedByScore[sortedByScore.length - 1];

  // 동전 크기 비교 (직관적인 실력 체감)
  const getCoinComparison = (spreadMm: number) => {
    if (spreadMm <= 0) return '-';
    if (spreadMm < 18.0) return '🪙 10원 동전(18mm)급 밀집!';
    if (spreadMm < 21.6) return '🪙 50원 동전(21.6mm) 크기';
    if (spreadMm < 24.0) return '🪙 100원 동전(24mm) 크기';
    if (spreadMm < 26.5) return '🪙 500원 동전(26.5mm) 크기';
    return '집탄군 추가 축소 필요';
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <ScoreBreakdown imageUrl={imageUrl} shots={shots} virtualPins={virtualPins} calibration={calibration} selectedShotId={selectedShotId} onSelectShot={onSelectShot} />
      <section aria-label="탄착 분석 상태" className="surface-card p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">감지</p><p className="mt-1 text-2xl font-extrabold">{evidence.detected}<span className="ml-1 text-xs font-normal">발</span></p></div>
          <div><p className="text-xs font-semibold text-purple-700 dark:text-purple-400">추정</p><p className="mt-1 text-2xl font-extrabold">{evidence.estimated}<span className="ml-1 text-xs font-normal">발</span></p></div>
          <div><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">미확정</p><p className="mt-1 text-2xl font-extrabold">{evidence.unresolved ?? '—'}<span className="ml-1 text-xs font-normal">{evidence.unresolved === null ? '발수 미입력' : '발'}</span></p></div>
        </div>
        {(evidence.manual > 0 || evidence.legacy > 0) && <p className="mt-3 text-xs text-slate-500">별도 표시: 수동 {evidence.manual}발 · 미검증 기록 {evidence.legacy}발</p>}
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">감지는 이미지에서 찾은 탄착점, 추정은 부족한 발수를 겹친 영역에 배치한 핀입니다.</p>
        {evidence.excess > 0 && <p className="mt-2 text-xs font-bold text-red-600">선택 발수보다 {evidence.excess}개 많습니다. 오검출·과분할 여부를 확인해주세요.</p>}
        {unresolvedRegions.length > 0 && <details className="mt-1"><summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold">겹침·미확정 영역 {unresolvedRegions.length}곳 보기</summary><div className="space-y-2 text-xs leading-relaxed text-slate-500">{unresolvedRegions.map((r,i) => <p key={r.id}>영역 {i+1}: {r.reason}</p>)}</div></details>}
      </section>
      {analysisWarnings.length > 0 && (
        <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="text-sm font-bold">{shots.length === 0 ? '탄착 후보를 찾지 못했습니다' : `탄착 후보 ${shots.length}개 · 확인이 필요해요`}</p>
          <p className="mt-1 text-xs leading-relaxed">{targetCount > 0 && shots.length !== targetCount ? `선택한 ${targetCount}발과 후보 수가 다릅니다. ` : ''}총점 완성에서 추가 발수와 점수를 확인하세요.</p>
          <details className="mt-1"><summary className="flex min-h-11 cursor-pointer items-center text-xs font-semibold underline underline-offset-4">분석 결과 확인 안내</summary><div className="space-y-2 pb-1 text-xs leading-relaxed">{analysisWarnings.map(warning => <p key={warning}>{warning}</p>)}<p>표적 보정에서 핀을 추가·이동·삭제하세요. 점수와 통계는 표시된 후보만 기준으로 계산합니다.</p></div></details>
        </div>
      )}
      {/* 1. 상단 히어로 스코어 카드 (시원시원한 대형 폰트) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm dark:shadow-none flex flex-col gap-4 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Award className="w-4 h-4 text-amber-500" />
            감지 탄착점 소계 ({stats.totalShots}개 · 추정 핀 제외)
          </span>
          <span className="text-xs font-black bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-500/30">
            {analysisWarnings.length ? '참고 점수' : '소수점 채점'}
          </span>
        </div>

        <div className="flex items-baseline justify-between pt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter">
              {stats.totalScore.toFixed(1)}
            </span>
            <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
              {targetCount > 0 && shots.length < targetCount ? '점' : `/ ${stats.maxPossibleScore.toFixed(1)}`}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-bold text-slate-400 block">감지 탄착점 평균</span>
            <span className="text-2xl font-black text-red-600 dark:text-amber-400">
              {stats.averageScore.toFixed(2)}
            </span>
          </div>
        </div>

        {/* 3대 핵심 메트릭 그리드 */}
        <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          {/* 집탄 크기 */}
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Target className="w-3 h-3 text-red-500" />
              집탄 분산
            </span>
            <div className="mt-1 flex items-baseline gap-0.5">
              <span className="text-xl font-extrabold text-slate-900 dark:text-cyan-400">
                {stats.extremeSpread_mm.toFixed(1)}
              </span>
              <span className="text-[10px] font-bold text-slate-400">mm</span>
            </div>
            <span className="hidden text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate mt-0.5 sm:block">
              {getCoinComparison(stats.extremeSpread_mm)}
            </span>
          </div>

          {/* CEP50 */}
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Compass className="w-3 h-3 text-purple-500" />
              CEP50
            </span>
            <div className="mt-1 flex items-baseline gap-0.5">
              <span className="text-xl font-extrabold text-slate-900 dark:text-purple-300">
                {stats.cep50_mm.toFixed(1)}
              </span>
              <span className="text-[10px] font-bold text-slate-400">mm</span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
              50% 밀집반경
            </span>
          </div>

          {/* 최고/최저 */}
          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              최고 / 최저
            </span>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-base font-black text-amber-500">
                {bestShot ? bestShot.score.toFixed(1) : '-'}
              </span>
              <span className="text-xs text-slate-300 dark:text-slate-600">/</span>
              <span className="text-base font-black text-slate-500 dark:text-slate-400">
                {lowestShot ? lowestShot.score.toFixed(1) : '-'}
              </span>
            </div>
            <span className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
              격차: {bestShot && lowestShot ? (bestShot.score - lowestShot.score).toFixed(1) : '-'}점
            </span>
          </div>
        </div>
      </div>

      {/* 2. 조준기 영점 클릭 가이드 (하이라이트 카드) */}
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-slate-900 dark:to-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40 rounded-3xl p-4 flex items-center justify-between shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center flex-shrink-0">
            <Sliders className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h4 className="text-xs font-black text-cyan-900 dark:text-cyan-300 flex flex-wrap items-center gap-1.5">
              <span>영점 클릭 수정 가이드</span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                (감지 핀 평균 · 추정 핀 제외: X {stats.mpiX_mm >= 0 ? `+${stats.mpiX_mm}` : stats.mpiX_mm}mm, Y {stats.mpiY_mm >= 0 ? `+${stats.mpiY_mm}` : stats.mpiY_mm}mm)
              </span>
            </h4>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2 text-xs font-bold text-slate-700 dark:text-slate-200">
              <span>
                좌우: <strong className="text-cyan-600 dark:text-cyan-400 font-extrabold">{sightGuide.horizontalGuide}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span>
                상하: <strong className="text-cyan-600 dark:text-cyan-400 font-extrabold">{sightGuide.verticalGuide}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
