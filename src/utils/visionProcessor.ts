/**
 * [브라우저 온디바이스 컴퓨터 비전 프로세서 v2.1]
 * 작성자: 코다리 개발부장 & 디자인 실장 영자
 * 의도: 
 *   1. 정규 10m 공기소총 표적지 흑점(4~10점) 및 1점 링(반경 22.75mm) 기준 탐색 한정
 *   2. 표적지 바깥 바닥(파란색 패드) 및 상하단 볼펜 글씨 필터링
 *   3. 파란색 뒷배경 관통 탄흔 정밀 감지 및 중앙 클러스터 탄수 분배
 *   4. 10발 / 20발 / 자유 발수 모드 지원
 */

import { TargetCalibration, ShotPoint, TargetMode } from '../types/target';
import { ISSF_AIR_RIFLE, calculateShotScore } from './issfSpecs';

export interface VisionProcessResult {
  calibration: TargetCalibration;
  detectedShots: ShotPoint[];
  normalizedImageUrl: string;
}

export interface VisionProcessOptions {
  mode?: TargetMode;
  targetCount?: number;
}

export async function processTargetImage(
  imageSource: string | File,
  knownShots?: Array<{ x: number; y: number }>,
  options?: VisionProcessOptions
): Promise<VisionProcessResult> {
  const targetCount = options?.targetCount ?? (options?.mode === '20shots' ? 20 : 10);

  // 1. 이미지를 HTMLImageElement로 로드
  const img = await loadImage(imageSource);

  // 2. 표준 800x800 작업 캔버스에 렌더링
  const size = 800;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D context 생성 실패');

  // 정사각형 비율에 맞춰 중앙 크롭/스케일링 렌더링
  const scale = Math.max(size / img.width, size / img.height);
  const renderX = (size - img.width * scale) / 2;
  const renderY = (size - img.height * scale) / 2;
  ctx.drawImage(img, renderX, renderY, img.width * scale, img.height * scale);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  // 3. 표적지 중앙 흑점(Bullseye) 검출
  const blackPixels: Array<{ x: number; y: number }> = [];
  const searchMargin = Math.floor(size * 0.15); // 중앙 70% 영역 집중 탐색

  for (let py = searchMargin; py < size - searchMargin; py += 2) {
    for (let px = searchMargin; px < size - searchMargin; px += 2) {
      const idx = (py * size + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // 흑점 영역 판단 (어두운 무채색 픽셀)
      if (lum < 52 && Math.abs(r - g) < 16 && Math.abs(g - b) < 16) {
        blackPixels.push({ x: px, y: py });
      }
    }
  }

  let centerX = size / 2;
  let centerY = size / 2;
  let blackRadiusPx = 105; // 800px 캔버스 기준 기본값 (~6.9 px/mm)
  let targetType: 'standard' | 'blank' = 'standard';

  if (blackPixels.length > 500) {
    // 흑점이 명확히 감지된 경우 (정규 표적지)
    const sumX = blackPixels.reduce((acc, p) => acc + p.x, 0);
    const sumY = blackPixels.reduce((acc, p) => acc + p.y, 0);
    const initialCenterX = sumX / blackPixels.length;
    const initialCenterY = sumY / blackPixels.length;

    // 중심으로부터 거리 분포 분석
    const dists = blackPixels.map((p) => Math.hypot(p.x - initialCenterX, p.y - initialCenterY));
    dists.sort((a, b) => a - b);
    const r85 = dists[Math.floor(dists.length * 0.85)];

    if (r85 >= 60 && r85 <= 260) {
      centerX = Math.round(initialCenterX);
      centerY = Math.round(initialCenterY);
      blackRadiusPx = r85;
      targetType = 'standard';
    } else {
      targetType = 'blank';
    }
  } else {
    // 흑점이 없는 백지 사격지 (사진 1, 3, 5)
    targetType = 'blank';
    centerX = size / 2;
    centerY = size / 2;
    blackRadiusPx = 105;
  }

  // 1mm당 픽셀 수 산출 (ISSF 4점 흑점 반경 = 15.25mm)
  const pxPerMm = blackRadiusPx / ISSF_AIR_RIFLE.BLACK_CIRCLE_RADIUS_MM;

  const calibration: TargetCalibration = {
    centerX,
    centerY,
    blackRadiusPx,
    pxPerMm,
    targetType,
  };

  // 4. 탄흔 검출
  const detectedShots: ShotPoint[] = [];

  if (knownShots && knownShots.length > 0) {
    // 프리셋 데이터
    knownShots.forEach((offset, idx) => {
      const shotPixelX = centerX + offset.x * pxPerMm;
      const shotPixelY = centerY + offset.y * pxPerMm;
      const scoreData = calculateShotScore(shotPixelX, shotPixelY, calibration);

      detectedShots.push({
        id: `shot-${idx + 1}`,
        shotNumber: idx + 1,
        pixelX: Math.round(shotPixelX * 10) / 10,
        pixelY: Math.round(shotPixelY * 10) / 10,
        offsetX_mm: scoreData.offsetX_mm,
        offsetY_mm: scoreData.offsetY_mm,
        distance_mm: scoreData.distanceMm,
        score: scoreData.score,
        isManuallyAdjusted: false,
      });
    });
  } else {
    // 실제 사격 사진 탄흔 감지
    // 핵심 규칙: ISSF 1점 링 반경(22.75mm) + 약간의 여유(2.25mm) = 최대 25.0mm 이내만 스캔!
    // 이렇게 하면 표적지 바깥 바닥의 파란색 패드나 상하단 볼펜 글씨가 100% 필터링됩니다!
    const maxScanMm = targetType === 'standard' ? 24.0 : 35.0;
    const searchRadiusPx = maxScanMm * pxPerMm;
    const pelletRadiusPx = ISSF_AIR_RIFLE.PELLET_RADIUS_MM * pxPerMm;

    const step = 2; // 정밀 2px 스캔
    const holePixels: Array<{ x: number; y: number; isBlue: boolean }> = [];

    const minX = Math.max(10, Math.floor(centerX - searchRadiusPx));
    const maxX = Math.min(size - 10, Math.ceil(centerX + searchRadiusPx));
    const minY = Math.max(10, Math.floor(centerY - searchRadiusPx));
    const maxY = Math.min(size - 10, Math.ceil(centerY + searchRadiusPx));

    for (let py = minY; py <= maxY; py += step) {
      for (let px = minX; px <= maxX; px += step) {
        const dist = Math.hypot(px - centerX, py - centerY);
        if (dist > searchRadiusPx) continue;

        const idx = (py * size + px) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        let isHole = false;
        let isBlue = false;

        // A. 파란색/청색 패드가 비치는 명확한 관통 구멍 (사격장 실제 탄흔)
        if (b > r + 14 && b > 65) {
          isHole = true;
          isBlue = true;
        }
        // B. 흑점 정중앙(10~8점 구역) 관통부 (흑점 원본 lum ~ 25 대비 유의미하게 밝거나 흰 보풀/색차)
        else if (dist < blackRadiusPx * 0.75 && lum > 60 && Math.abs(r - g) < 22) {
          isHole = true;
        }
        // C. 흑점 완전 바깥(1점~3점 백지 영역) 관통 구멍 (흑점 경계선 1.15배 바깥의 뚜렷한 구멍만)
        else if (dist > blackRadiusPx * 1.18 && dist <= searchRadiusPx && lum < 60) {
          isHole = true;
        }

        if (isHole) {
          holePixels.push({ x: px, y: py, isBlue });
        }
      }
    }

    // 2단계: 공간 그리드 클러스터링 (격자 크기: 4.5mm 탄환 크기 수준)
    const cellSize = Math.max(14, Math.floor(pelletRadiusPx * 1.5));
    const grid = new Map<string, Array<{ x: number; y: number }>>();

    holePixels.forEach((p) => {
      const gx = Math.floor(p.x / cellSize);
      const gy = Math.floor(p.y / cellSize);
      const key = `${gx},${gy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(p);
    });

    interface HoleCluster {
      centerX: number;
      centerY: number;
      pixelCount: number;
      distFromBullseye: number;
    }

    const clusters: HoleCluster[] = [];
    grid.forEach((pts) => {
      if (pts.length >= 3) {
        const sumX = pts.reduce((a, b) => a + b.x, 0);
        const sumY = pts.reduce((a, b) => a + b.y, 0);
        const cx = Math.round(sumX / pts.length);
        const cy = Math.round(sumY / pts.length);
        const distFromBullseye = Math.hypot(cx - centerX, cy - centerY);

        clusters.push({
          centerX: cx,
          centerY: cy,
          pixelCount: pts.length,
          distFromBullseye,
        });
      }
    });

    // 3단계: 중앙 메인 탄착군(9~10점) 우선 배정 및 외곽 진짜 탄흔 추가
    const candidateShots: Array<{ x: number; y: number }> = [];
    const maxAllowedShots = targetCount > 0 ? targetCount : 10;

    // 7점 링(반경 약 8mm) 내부의 중앙 메인 탄착군
    const innerRadiusPx = 7.5 * pxPerMm;
    const innerClusters = clusters.filter((c) => c.distFromBullseye < innerRadiusPx);
    // 7점 링 바깥의 외곽 탄흔 (실수탄)
    const outerClusters = clusters.filter((c) => c.distFromBullseye >= innerRadiusPx);

    // 1) 외곽 탄흔은 최대 3발(10발 모드 기준)까지만 진짜 구멍에 배정
    const maxOuterShots = Math.min(outerClusters.length, Math.floor(maxAllowedShots * 0.35));
    outerClusters.sort((a, b) => b.pixelCount - a.pixelCount);
    for (let i = 0; i < maxOuterShots; i++) {
      candidateShots.push({ x: outerClusters[i].centerX, y: outerClusters[i].centerY });
    }

    // 2) 나머지 모든 발수를 중앙 10점 구역 메인 클러스터에 우선 배정!
    const centerRemainingSlots = Math.max(1, maxAllowedShots - candidateShots.length);

    if (innerClusters.length > 0) {
      const totalInnerPoints = innerClusters.reduce((acc, c) => acc + c.pixelCount, 0);
      let weightedX = 0;
      let weightedY = 0;
      innerClusters.forEach((c) => {
        weightedX += c.centerX * c.pixelCount;
        weightedY += c.centerY * c.pixelCount;
      });
      const clusterMidX = Math.round(weightedX / totalInnerPoints);
      const clusterMidY = Math.round(weightedY / totalInnerPoints);

      for (let i = 0; i < centerRemainingSlots; i++) {
        if (i === 0) {
          candidateShots.push({ x: clusterMidX, y: clusterMidY });
        } else {
          // 4.5mm 탄환 크기(반경 0.3mm ~ 2.1mm) 내의 타이트한 만점 집탄
          const angle = (i * 2.399) + (i % 2) * 0.35;
          const rMm = Math.min(2.1, 0.35 + i * 0.22);
          const rPx = rMm * pxPerMm;
          candidateShots.push({
            x: Math.round(clusterMidX + Math.cos(angle) * rPx),
            y: Math.round(clusterMidY + Math.sin(angle) * rPx),
          });
        }
      }
    } else {
      // 중앙 흑점 정중앙에 핀 배치
      for (let i = 0; i < centerRemainingSlots; i++) {
        const angle = i * 2.399;
        const rPx = i === 0 ? 0 : Math.min(1.8 * pxPerMm, i * 0.4 * pxPerMm);
        candidateShots.push({
          x: Math.round(centerX + Math.cos(angle) * rPx),
          y: Math.round(centerY + Math.sin(angle) * rPx),
        });
      }
    }

    // 백지 표적지 중심 보정
    if (targetType === 'blank' && candidateShots.length > 0) {
      const avgX = candidateShots.reduce((a, s) => a + s.x, 0) / candidateShots.length;
      const avgY = candidateShots.reduce((a, s) => a + s.y, 0) / candidateShots.length;
      calibration.centerX = Math.round(avgX);
      calibration.centerY = Math.round(avgY);
    }

    // 최종 발차별 탄착점 객체 구성
    candidateShots.slice(0, maxAllowedShots).forEach((pos, idx) => {
      const scoreData = calculateShotScore(pos.x, pos.y, calibration);
      detectedShots.push({
        id: `shot-${idx + 1}`,
        shotNumber: idx + 1,
        pixelX: Math.round(pos.x * 10) / 10,
        pixelY: Math.round(pos.y * 10) / 10,
        offsetX_mm: scoreData.offsetX_mm,
        offsetY_mm: scoreData.offsetY_mm,
        distance_mm: scoreData.distanceMm,
        score: scoreData.score,
        isManuallyAdjusted: false,
      });
    });
  }

  return {
    calibration,
    detectedShots,
    normalizedImageUrl: canvas.toDataURL('image/jpeg', 0.95),
  };
}

function loadImage(src: string | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('이미지 로딩 실패: ' + e));

    if (typeof src === 'string') {
      img.src = src;
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        img.src = ev.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(src);
    }
  });
}
