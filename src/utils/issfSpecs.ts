/**
 * [ISSF 10m 공기소총 공식 규격 및 정밀 계산 유틸리티]
 * 작성자: 코다리 개발부장
 * 의도: ISSF 공식 10.9 만점 소수점 환산 및 사수 맞춤형 영점 클릭 계산
 */

import { ShotPoint, GroupingStats, TargetCalibration } from '../types/target';

export const ISSF_AIR_RIFLE = {
  NAME: '10m 공기소총 (Air Rifle)',
  PELLET_DIAMETER_MM: 4.5,
  PELLET_RADIUS_MM: 2.25,
  BLACK_CIRCLE_DIAMETER_MM: 30.5,
  BLACK_CIRCLE_RADIUS_MM: 15.25, // 4점 링 외곽
  RING_10_DIAMETER_MM: 0.5,
  RING_STEP_MM: 2.5, // 링당 반경 증가폭 (5.0mm 직경 증가)
  MAX_SCORE: 10.9,
  CLICK_MM: 0.5, // 일반적인 10m 공기소총 조준기 1클릭당 표적지 이동량 (~0.5mm)
};

/**
 * 픽셀 좌표로부터 ISSF 공식 소수점 점수 계산
 */
export function calculateShotScore(
  pixelX: number,
  pixelY: number,
  calibration: TargetCalibration
): {
  score: number;
  distanceMm: number;
  offsetX_mm: number;
  offsetY_mm: number;
} {
  const dxPx = pixelX - calibration.centerX;
  const dyPx = pixelY - calibration.centerY;

  const offsetX_mm = dxPx / calibration.pxPerMm;
  const offsetY_mm = dyPx / calibration.pxPerMm;
  const distanceMm = Math.hypot(offsetX_mm, offsetY_mm);

  // ISSF 소수점 공식: 거리 0mm일 때 10.9점
  // 반경 0.25mm당 0.1점 감소
  let rawScore = ISSF_AIR_RIFLE.MAX_SCORE - (distanceMm / 0.25) * 0.1;
  if (rawScore < 0) rawScore = 0;

  const score = Math.round(rawScore * 10) / 10;

  return {
    score,
    distanceMm: Math.round(distanceMm * 100) / 100,
    offsetX_mm: Math.round(offsetX_mm * 100) / 100,
    offsetY_mm: Math.round(offsetY_mm * 100) / 100,
  };
}

/**
 * 사격 세션 종합 통계 및 탄착군(Grouping) 분석
 */
export function calculateGroupingStats(shots: ShotPoint[], targetCount: number = 10): GroupingStats {
  const maxPossibleScore = targetCount > 0 
    ? Math.round(targetCount * 10.9 * 10) / 10 
    : Math.round(Math.max(shots.length, 1) * 10.9 * 10) / 10;

  if (shots.length === 0) {
    return {
      totalShots: 0,
      totalScore: 0,
      averageScore: 0,
      maxPossibleScore,
      mpiX_mm: 0,
      mpiY_mm: 0,
      extremeSpread_mm: 0,
      cep50_mm: 0,
    };
  }

  const totalShots = shots.length;
  const totalScore = Math.round(shots.reduce((acc, s) => acc + s.score, 0) * 10) / 10;
  const averageScore = Math.round((totalScore / totalShots) * 100) / 100;

  // 탄착 중심 (MPI: Mean Point of Impact)
  const mpiX_mm = Math.round((shots.reduce((acc, s) => acc + s.offsetX_mm, 0) / totalShots) * 100) / 100;
  const mpiY_mm = Math.round((shots.reduce((acc, s) => acc + s.offsetY_mm, 0) / totalShots) * 100) / 100;

  // 최대 분산 크기 (Extreme Spread, 가장 먼 두 탄흔 간의 거리)
  let extremeSpread_mm = 0;
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const dist = Math.hypot(
        shots[i].offsetX_mm - shots[j].offsetX_mm,
        shots[i].offsetY_mm - shots[j].offsetY_mm
      );
      if (dist > extremeSpread_mm) {
        extremeSpread_mm = dist;
      }
    }
  }

  // CEP50 (탄환의 50%가 모인 반경 - MPI 기준 거리 중앙값)
  const distancesFromMpi = shots.map((s) =>
    Math.hypot(s.offsetX_mm - mpiX_mm, s.offsetY_mm - mpiY_mm)
  );
  distancesFromMpi.sort((a, b) => a - b);
  const medianIdx = Math.floor(distancesFromMpi.length * 0.5);
  const cep50_mm = Math.round((distancesFromMpi[medianIdx] || 0) * 100) / 100;

  return {
    totalShots,
    totalScore,
    averageScore,
    maxPossibleScore,
    mpiX_mm,
    mpiY_mm,
    extremeSpread_mm: Math.round(extremeSpread_mm * 100) / 100,
    cep50_mm,
  };
}

/**
 * 조준기 영점 클릭 추천 가이드
 * 예: 우탄 1.5mm -> "좌측 3클릭"
 */
export function getSightAdjustmentGuide(mpiX_mm: number, mpiY_mm: number): {
  horizontalGuide: string;
  verticalGuide: string;
} {
  const xClicks = Math.round(Math.abs(mpiX_mm) / ISSF_AIR_RIFLE.CLICK_MM);
  const yClicks = Math.round(Math.abs(mpiY_mm) / ISSF_AIR_RIFLE.CLICK_MM);

  let horizontalGuide = '정중앙 (조정 불필요)';
  if (xClicks > 0) {
    horizontalGuide = mpiX_mm > 0 ? `좌측(L) ${xClicks}클릭` : `우측(R) ${xClicks}클릭`;
  }

  let verticalGuide = '정중앙 (조정 불필요)';
  if (yClicks > 0) {
    verticalGuide = mpiY_mm > 0 ? `상단(UP) ${yClicks}클릭` : `하단(DOWN) ${yClicks}클릭`;
  }

  return { horizontalGuide, verticalGuide };
}
