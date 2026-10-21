/**
 * [영자 실장의 모던 스코어보드 & 사수 분석 패널]
 * 작성자: 디자인 실장 영자 & 코다리 부장
 * 의도: 모바일에서도 시원하게 읽히는 대형 디스플레이 타이포그래피(48px 행 높이)와
 *       라이트/다크 듀얼 테마 지원
 */

import React from 'react';
import { ShotPoint, GroupingStats } from '../types/target';
import { getSightAdjustmentGuide } from '../utils/issfSpecs';
import { Target, Compass, Award, Sliders, CheckCircle2 } from 'lucide-react';

interface ScoreBoardProps {
  shots: ShotPoint[];
  stats: GroupingStats;
  targetCount: number;
  analysisWarnings: string[];
  selectedShotId: string | null;
  onSelectShot: (id: string | null) => void;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  shots,
  stats,
  targetCount,
  analysisWarnings,
  selectedShotId,
  onSelectShot,
}) => {
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
      {analysisWarnings.length > 0 && (
        <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-bold">
            {shots.length === 0 ? '탄착 후보를 찾지 못했습니다.' : `탄착 후보 ${shots.length}개 — 수동 확인 필요`}
          </p>
          {targetCount > 0 && shots.length !== targetCount && (
            <p className="mt-1">선택한 {targetCount}발과 후보 수가 다릅니다. 부족한 좌표를 자동으로 채우지 않습니다.</p>
          )}
          {analysisWarnings.map((warning) => <p key={warning} className="mt-1 text-xs">{warning}</p>)}
          <p className="mt-1 text-xs">표적에서 핀을 추가·이동·삭제해 확인하세요. 아래 점수와 통계는 현재 표시된 후보만 기준으로 계산합니다.</p>
        </div>
      )}
      {/* 1. 상단 히어로 스코어 카드 (시원시원한 대형 폰트) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-xl shadow-slate-200/40 dark:shadow-none flex flex-col gap-4 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Award className="w-4 h-4 text-amber-500" />
            현재 탄착점 합계 ({stats.totalShots}개)
          </span>
          <span className="text-xs font-black bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-500/30">
            ISSF 소수점
          </span>
        </div>

        <div className="flex items-baseline justify-between pt-1">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter">
              {stats.totalScore.toFixed(1)}
            </span>
            <span className="text-sm font-bold text-slate-400 dark:text-slate-500">
              / {stats.maxPossibleScore ? stats.maxPossibleScore.toFixed(1) : (stats.totalShots * 10.9).toFixed(1)}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-bold text-slate-400 block">표시된 탄착점 평균</span>
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
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
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
            <h4 className="text-xs font-black text-cyan-900 dark:text-cyan-300 flex items-center gap-1.5">
              <span>영점 클릭 수정 가이드</span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                (MPI: X {stats.mpiX_mm >= 0 ? `+${stats.mpiX_mm}` : stats.mpiX_mm}mm, Y {stats.mpiY_mm >= 0 ? `+${stats.mpiY_mm}` : stats.mpiY_mm}mm)
              </span>
            </h4>
            <div className="flex items-center gap-3 mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">
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

      {/* 3. 10발 상세 스코어 리스트 (모바일 터치 48px 행 높이) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl shadow-slate-200/40 dark:shadow-none transition-colors">
        <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-extrabold text-slate-800 dark:text-slate-200">발사별 정밀 데이터</span>
          <span className="text-[11px] font-medium">행 터치 시 과녁에서 핀 강조</span>
        </div>

        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/40 dark:bg-slate-950/40 text-[11px] text-slate-400 uppercase tracking-wider sticky top-0 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-bold">발차</th>
                <th className="py-2.5 px-4 font-bold">ISSF 점수</th>
                <th className="py-2.5 px-4 font-bold">중심거리</th>
                <th className="py-2.5 px-4 font-bold">좌우(X)</th>
                <th className="py-2.5 px-4 font-bold">상하(Y)</th>
                <th className="py-2.5 px-4 text-right font-bold">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {shots.map((shot) => {
                const isSelected = shot.id === selectedShotId;
                const isTen = shot.score >= 10.0;

                return (
                  <tr
                    key={shot.id}
                    onClick={() => onSelectShot(isSelected ? null : shot.id)}
                    className={`cursor-pointer transition-colors active:bg-red-500/20 ${
                      isSelected
                        ? 'bg-red-50 dark:bg-red-500/15 text-red-600 dark:text-white font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-slate-400">#{shot.shotNumber}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-lg font-black text-xs ${
                          isTen
                            ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/40'
                            : shot.score >= 9.0
                            ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {shot.score.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{shot.distance_mm.toFixed(2)}mm</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {shot.offsetX_mm >= 0 ? `+${shot.offsetX_mm.toFixed(2)}` : shot.offsetX_mm.toFixed(2)}mm
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                      {shot.offsetY_mm >= 0 ? `+${shot.offsetY_mm.toFixed(2)}` : shot.offsetY_mm.toFixed(2)}mm
                    </td>
                    <td className="py-3 px-4 text-right">
                      {shot.isManuallyAdjusted ? (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded font-sans font-bold">
                          수동
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans font-bold">
                          자동
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
