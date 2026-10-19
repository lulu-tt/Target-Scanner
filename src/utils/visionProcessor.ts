/**
 * [브라우저 온디바이스 컴퓨터 비전 프로세서]
 * 작성자: 코다리 개발부장
 * 의도: 외부 서버 없이 순수 HTML5 Canvas와 이미지 픽셀 분석을 통해
 *       표적지 흑점(30.5mm) 중심 검출, 스케일(px/mm) 도출, 탄흔 감지를 고속으로 수행합니다.
 */

import { TargetCalibration, ShotPoint } from '../types/target';
import { ISSF_AIR_RIFLE, calculateShotScore } from './issfSpecs';

export interface VisionProcessResult {
  calibration: TargetCalibration;
  detectedShots: ShotPoint[];
  normalizedImageUrl: string;
}

/**
 * 표적지 이미지 분석 및 흑점/탄흔 검출 메인 함수
 */
export async function processTargetImage(
  imageSource: string | File,
  knownShots?: Array<{ x: number; y: number }>
): Promise<VisionProcessResult> {
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
  const x = (size - img.width * scale) / 2;
  const y = (size - img.height * scale) / 2;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

  const imageData = ctx.getImageData(0, 0, size, size);
  const data = imageData.data;

  // 3. 중앙 흑점(Bullseye) 검출: 명도(Luminance) 기반 중심점 탐색
  const blackPixels: Array<{ x: number; y: number }> = [];
  const searchMargin = size * 0.15; // 외곽 15% 제외한 중앙 영역 집중 탐색

  for (let py = searchMargin; py < size - searchMargin; py += 2) {
    for (let px = searchMargin; px < size - searchMargin; px += 2) {
      const idx = (py * size + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      // 흑점 영역 판단 (어두운 회색/검은색 픽셀)
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 50) {
        blackPixels.push({ x: px, y: py });
      }
    }
  }

  let centerX = size / 2;
  let centerY = size / 2;
  let blackRadiusPx = 244; // 800px 캔버스 기준 기본 15.25mm 반경 (~244px)

  if (blackPixels.length > 500) {
    // 흑점 픽셀들의 무게중심 도출
    const sumX = blackPixels.reduce((acc, p) => acc + p.x, 0);
    const sumY = blackPixels.reduce((acc, p) => acc + p.y, 0);
    centerX = Math.round(sumX / blackPixels.length);
    centerY = Math.round(sumY / blackPixels.length);

    // 중심으로부터 흑점 외곽까지의 반경 추정 (상위 90% 백분위수 거리)
    const dists = blackPixels.map((p) => Math.hypot(p.x - centerX, p.y - centerY));
    dists.sort((a, b) => a - b);
    const r90 = dists[Math.floor(dists.length * 0.9)];
    if (r90 > 100 && r90 < 380) {
      blackRadiusPx = r90;
    }
  }

  // 1mm당 픽셀 수 산출 (흑점 공식 반경 = 15.25mm)
  const pxPerMm = blackRadiusPx / ISSF_AIR_RIFLE.BLACK_CIRCLE_RADIUS_MM;

  const calibration: TargetCalibration = {
    centerX,
    centerY,
    blackRadiusPx,
    pxPerMm,
  };

  // 4. 탄흔 검출 (프리셋이 제공된 경우 직접 계산, 업로드 이미지의 경우 어두운 탄착 구멍 탐색)
  const detectedShots: ShotPoint[] = [];

  if (knownShots && knownShots.length > 0) {
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
    // 일반 업로드 이미지의 경우: 표적 중앙 반경 25mm 내부에서 4.5mm 탄흔 후보군 감지
    const searchRadiusPx = 25 * pxPerMm;
    const pelletPxRadius = ISSF_AIR_RIFLE.PELLET_RADIUS_MM * pxPerMm;
    const candidates: Array<{ x: number; y: number; darkCount: number }> = [];

    // 그리드 샘플링
    const step = Math.max(4, Math.floor(pelletPxRadius * 0.5));
    for (let py = centerY - searchRadiusPx; py <= centerY + searchRadiusPx; py += step) {
      for (let px = centerX - searchRadiusPx; px <= centerX + searchRadiusPx; px += step) {
        if (Math.hypot(px - centerX, py - centerY) > searchRadiusPx) continue;

        // 원형 영역 내의 어두운 강도 검사
        let darkSum = 0;
        let count = 0;
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
          const sampleX = Math.round(px + Math.cos(angle) * (pelletPxRadius * 0.6));
          const sampleY = Math.round(py + Math.sin(angle) * (pelletPxRadius * 0.6));
          if (sampleX >= 0 && sampleX < size && sampleY >= 0 && sampleY < size) {
            const idx = (sampleY * size + sampleX) * 4;
            const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
            darkSum += lum;
            count++;
          }
        }
        if (count > 0 && darkSum / count < 25) {
          candidates.push({ x: px, y: py, darkCount: darkSum / count });
        }
      }
    }

    // 인접한 후보군 클러스터링
    const clusteredShots: Array<{ x: number; y: number }> = [];
    candidates.forEach((cand) => {
      const exists = clusteredShots.some(
        (c) => Math.hypot(c.x - cand.x, c.y - cand.y) < pelletPxRadius * 1.2
      );
      if (!exists && clusteredShots.length < 10) {
        clusteredShots.push({ x: cand.x, y: cand.y });
      }
    });

    clusteredShots.forEach((pos, idx) => {
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
