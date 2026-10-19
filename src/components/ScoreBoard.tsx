/**
 * [실시간 스코어보드 & 사수 탄착군 분석 패널]
 * 작성자: 코다리 개발부장
 * 의도: 10발 소수점 채점표, 총점/평균, 영점 편차(MPI) 및 조준기 클릭 수정 가이드를 한눈에 브리핑합니다.
 */

import React from 'react';
import { ShotPoint, GroupingStats } from '../types/target';
import { getSightAdjustmentGuide } from '../utils/issfSpecs';
import { Target, Compass, Award, Sliders, ChevronRight } from 'lucide-react';

interface ScoreBoardProps {
  shots: ShotPoint[];
  stats: GroupingStats;
  selectedShotId: string | null;
  onSelectShot: (id: string | null) => void;
}

export const ScoreBoard: React.FC<ScoreBoardProps> = ({
  shots,
  stats,
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
    if (spreadMm < 18.0) return '🪙 10원 동전(18mm)보다 밀집!';
    if (spreadMm < 21.6) return '🪙 50원 동전(21.6mm) 크기';
    if (spreadMm < 24.0) return '🪙 100원 동전(24mm) 크기';
    if (spreadMm < 26.5) return '🪙 500원 동전(26.5mm) 크기';
    return '집탄군 추가 축소 필요';
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* 1. 상단 핵심 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* 총점 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-yellow-400" />
            세션 총점 ({stats.totalShots}발)
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {stats.totalScore.toFixed(1)}
            </span>
            <span className="text-xs text-slate-500 font-semibold">/ {(stats.totalShots * 10.9).toFixed(1)}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">
            평균 <strong className="text-yellow-400 font-bold">{stats.averageScore.toFixed(2)}</strong>점
          </span>
        </div>

        {/* 집탄군 크기 (Extreme Spread) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-red-400" />
            집탄 크기 (분산도)
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-cyan-400 tracking-tight">
              {stats.extremeSpread_mm.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-semibold">mm</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-medium mt-1 truncate">
            {getCoinComparison(stats.extremeSpread_mm)}
          </span>
        </div>

        {/* 반수필중반경 (CEP50) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-purple-400" />
            CEP50 (50% 집탄반경)
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-purple-300 tracking-tight">
              {stats.cep50_mm.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400 font-semibold">mm</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">
            상위 50% 탄환 밀집 구역
          </span>
        </div>

        {/* 최고점 탄환 */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">최고 / 최저 발사</span>
          <div className="mt-1 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 block">최고 발</span>
              <span className="text-xl font-bold text-yellow-400">
                {bestShot ? `${bestShot.score.toFixed(1)}` : '-'}
              </span>
            </div>
            <div className="h-6 w-[1px] bg-slate-800" />
            <div>
              <span className="text-[10px] text-slate-400 block">최저 발</span>
              <span className="text-xl font-bold text-slate-300">
                {lowestShot ? `${lowestShot.score.toFixed(1)}` : '-'}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">
            격차: {bestShot && lowestShot ? (bestShot.score - lowestShot.score).toFixed(1) : '-'}점
          </span>
        </div>
      </div>

      {/* 2. 조준기 영점 클릭 가이드 (코다리의 추천) */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-cyan-900/40 rounded-xl p-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
              <span>🎯 코다리의 조준기 영점 수정 가이드</span>
              <span className="text-[10px] font-normal text-slate-400">
                (MPI 편차: X {stats.mpiX_mm >= 0 ? `+${stats.mpiX_mm}` : stats.mpiX_mm}mm, Y {stats.mpiY_mm >= 0 ? `+${stats.mpiY_mm}` : stats.mpiY_mm}mm)
              </span>
            </h4>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="text-slate-200">
                좌우: <strong className="text-cyan-400">{sightGuide.horizontalGuide}</strong>
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-200">
                상하: <strong className="text-cyan-400">{sightGuide.verticalGuide}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 10발 상세 스코어 리스트 테이블 */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="font-semibold text-slate-200">발사별 정밀 데이터</span>
          <span className="text-[11px]">행 클릭 시 해당 탄착점 강조</span>
        </div>

        <div className="max-h-[260px] overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950/40 text-[11px] text-slate-400 uppercase tracking-wider sticky top-0">
              <tr>
                <th className="py-2 px-3">발차</th>
                <th className="py-2 px-3">ISSF 점수</th>
                <th className="py-2 px-3">중심거리</th>
                <th className="py-2 px-3">좌우(X) 편차</th>
                <th className="py-2 px-3">상하(Y) 편차</th>
                <th className="py-2 px-3 text-right">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {shots.map((shot) => {
                const isSelected = shot.id === selectedShotId;
                const isTen = shot.score >= 10.0;

                return (
                  <tr
                    key={shot.id}
                    onClick={() => onSelectShot(isSelected ? null : shot.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-red-500/15 text-white'
                        : 'hover:bg-slate-800/40 text-slate-300'
                    }`}
                  >
                    <td className="py-2 px-3 font-bold text-slate-400">#{shot.shotNumber}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-extrabold text-xs ${
                          isTen
                            ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                            : shot.score >= 9.0
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {shot.score.toFixed(1)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{shot.distance_mm.toFixed(2)}mm</td>
                    <td className="py-2 px-3 text-slate-400">
                      {shot.offsetX_mm >= 0 ? `+${shot.offsetX_mm.toFixed(2)}` : shot.offsetX_mm.toFixed(2)}mm
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {shot.offsetY_mm >= 0 ? `+${shot.offsetY_mm.toFixed(2)}` : shot.offsetY_mm.toFixed(2)}mm
                    </td>
                    <td className="py-2 px-3 text-right">
                      {shot.isManuallyAdjusted ? (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-sans">
                          수동보정
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-sans font-medium">자동감지</span>
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
