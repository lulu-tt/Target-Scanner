/**
 * [TargetScan AI 타입 정의]
 * 작성자: 코다리 개발부장
 * 의도: ISSF 공기소총 규격, 탄착점 좌표, 채점 결과 및 세션 저장 모델 정의
 */

export interface ShotPoint {
  id: string;
  shotNumber: number;
  pixelX: number;
  pixelY: number;
  offsetX_mm: number;      // 표적 중심 기준 X 편차 (+: 우, -: 좌)
  offsetY_mm: number;      // 표적 중심 기준 Y 편차 (+: 하, -: 상)
  distance_mm: number;     // 중심으로부터의 절대 거리 (mm)
  score: number;           // ISSF 소수점 점수 (0.0 ~ 10.9)
  isManuallyAdjusted?: boolean;
}

export type TargetMode = '10shots' | '20shots' | 'free' | 'blank';

export interface TargetCalibration {
  centerX: number;         // 표적지 내 흑점 또는 탄착 중심 X 픽셀
  centerY: number;         // 표적지 내 흑점 또는 탄착 중심 Y 픽셀
  blackRadiusPx: number;   // 흑점 픽셀 반경 (백지일 경우 기준 반경)
  pxPerMm: number;         // 1mm당 픽셀 수
  targetType?: 'standard' | 'blank'; // 정규 표적지 vs 백지 표적지
}

export interface GroupingStats {
  totalShots: number;
  totalScore: number;
  averageScore: number;
  maxPossibleScore: number; // 목표 발수 기준 만점 (10발: 109.0, 20발: 218.0)
  mpiX_mm: number;          // 탄착 중심(MPI) X 편차
  mpiY_mm: number;          // 탄착 중심(MPI) Y 편차
  extremeSpread_mm: number; // 최대 분산 (가장 먼 두 탄흔 간 거리)
  cep50_mm: number;         // 탄환의 50%가 모인 반경
}

export interface SavedSession {
  id: string;
  date: string;
  mode?: TargetMode;
  shots: ShotPoint[];
  stats: GroupingStats;
  targetImage?: string;     // 썸네일 이미지 dataUrl
  note?: string;
}

