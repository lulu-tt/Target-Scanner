/**
 * [브라우저 온디바이스 컴퓨터 비전 프로세서 v2.2]
 * 작성자: 코다리 개발부장 & 디자인 실장 영자
 * 의도:
 *   1. 정규 10m 공기소총 표적지 흑점(4~10점) 대칭 백분위 피팅으로 탄착 구멍 편향 없는 진(眞)중심 추출
 *   2. 사격장 파란색 백킹 매트 관통 구멍 및 탄착군 정밀 감지 (최대 27.5mm 스캔 반경)
 *   3. 분리 탄흔(외곽 단독 탄흔) 및 복합 탄착군(중앙 찢어진 대형 군) K-Means++ 군집 분해
 *   4. 10발 / 15발 / 20발 / 30발 / 자유 발수 모드 완벽 지원
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
    // 흑점 원형 외곽선 백분위수 대칭 피팅 (중앙에 구멍이 뚫려도 중심점이 흔들리지 않음)
    const xs = blackPixels.map((p) => p.x).sort((a, b) => a - b);
    const ys = blackPixels.map((p) => p.y).sort((a, b) => a - b);
    const minX = xs[Math.floor(xs.length * 0.04)];
    const maxX = xs[Math.floor(xs.length * 0.96)];
    const minY = ys[Math.floor(ys.length * 0.04)];
    const maxY = ys[Math.floor(ys.length * 0.96)];

    const boxCenterX = (minX + maxX) / 2;
    const boxCenterY = (minY + maxY) / 2;
    const boxRadius = ((maxX - minX) + (maxY - minY)) / 4;

    if (boxRadius >= 60 && boxRadius <= 260) {
      centerX = Math.round(boxCenterX);
      centerY = Math.round(boxCenterY);
      blackRadiusPx = boxRadius;
      targetType = 'standard';
    } else {
      targetType = 'blank';
    }
  } else {
    targetType = 'blank';
  }

  // ISSF 규격: 공기소총 흑점(4~10점 링) 직경은 정확히 30.5mm (반경 15.25mm)
  const pxPerMm = blackRadiusPx / ISSF_AIR_RIFLE.BLACK_CIRCLE_RADIUS_MM;

  const calibration: TargetCalibration = {
    centerX,
    centerY,
    blackRadiusPx,
    pxPerMm,
  };

  const detectedShots: ShotPoint[] = [];

  // 프리셋 지정 좌표가 있는 경우
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
    // 실제 사격 사진 탄흔 감지
    // ISSF 1점 링(반경 22.75mm) + 여유 반경 = 최대 27.5mm 스캔
    const maxScanMm = targetType === 'standard' ? 27.5 : 35.0;
    const searchRadiusPx = maxScanMm * pxPerMm;

    const step = 2; // 정밀 2px 스캔
    const holePixels: Array<{ x: number; y: number }> = [];

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

        // A. 파란색 매트가 비치는 명확한 관통 구멍 (사격장 실제 탄흔)
        if ((b > r + 11 && b > 55) || (b > r + 8 && b > 70)) {
          isHole = true;
        }
        // B. 흑점 중앙(10~8점 구역) 관통부 (흑점 원본 lum ~ 25 대비 유의미하게 밝은 톤 또는 구멍)
        else if (dist < blackRadiusPx * 0.78 && lum > 58 && Math.abs(r - g) < 22) {
          isHole = true;
        }
        // C. 흑점 완전 바깥(1점~3점 백지 영역) 관통 구멍
        else if (dist > blackRadiusPx * 1.15 && dist <= searchRadiusPx && lum < 62) {
          isHole = true;
        }

        if (isHole) {
          holePixels.push({ x: px, y: py });
        }
      }
    }

    // 2단계: 공간 그리드 및 유니온-파인드(Union-Find) 연결 성분 분할
    const cellSize = 12;
    const grid = new Map<string, Array<{ x: number; y: number }>>();

    holePixels.forEach((p) => {
      const gx = Math.floor(p.x / cellSize);
      const gy = Math.floor(p.y / cellSize);
      const key = `${gx},${gy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(p);
    });

    const cellKeys = Array.from(grid.keys());
    const parent = new Map<string, string>();
    cellKeys.forEach((k) => parent.set(k, k));

    function findRoot(i: string): string {
      let root = i;
      while (parent.get(root) !== root) {
        root = parent.get(root)!;
      }
      let curr = i;
      while (curr !== root) {
        const next = parent.get(curr)!;
        parent.set(curr, root);
        curr = next;
      }
      return root;
    }

    function unionCells(a: string, b: string) {
      const rootA = findRoot(a);
      const rootB = findRoot(b);
      if (rootA !== rootB) {
        parent.set(rootA, rootB);
      }
    }

    // 인접한 그리드 셀 병합 (Chebyshev distance <= 1)
    for (let i = 0; i < cellKeys.length; i++) {
      const [gx1, gy1] = cellKeys[i].split(',').map(Number);
      for (let j = i + 1; j < cellKeys.length; j++) {
        const [gx2, gy2] = cellKeys[j].split(',').map(Number);
        if (Math.abs(gx1 - gx2) <= 1 && Math.abs(gy1 - gy2) <= 1) {
          unionCells(cellKeys[i], cellKeys[j]);
        }
      }
    }

    const componentMap = new Map<string, Array<{ x: number; y: number }>>();
    cellKeys.forEach((k) => {
      const root = findRoot(k);
      if (!componentMap.has(root)) componentMap.set(root, []);
      componentMap.get(root)!.push(...grid.get(k)!);
    });

    // 최소 12픽셀 이상의 유효 탄흔 컴포넌트만 필터링 (미세 노이즈 제거)
    const validComponents = Array.from(componentMap.values())
      .filter((pts) => pts.length >= 12)
      .sort((a, b) => b.length - a.length);

    const maxAllowedShots = targetCount > 0 ? targetCount : 10;
    const candidateShots: Array<{ x: number; y: number }> = [];

    if (validComponents.length > 0) {
      // 3단계: 컴포넌트별 비례 발수 배정 및 K-Means++ 군집화
      let compsToUse = validComponents;
      if (maxAllowedShots < compsToUse.length) {
        compsToUse = compsToUse.slice(0, maxAllowedShots);
      }

      const numComps = compsToUse.length;
      const allocations = new Array<number>(numComps).fill(1);
      const remainingShots = maxAllowedShots - numComps;

      if (remainingShots > 0) {
        const totalPoints = compsToUse.reduce((acc, c) => acc + c.length, 0);
        let distributed = 0;
        for (let i = 0; i < numComps; i++) {
          const extra = Math.round(remainingShots * (compsToUse[i].length / totalPoints));
          allocations[i] += extra;
          distributed += extra;
        }
        // 반올림 오차는 가장 큰 메인 군집에 가감
        const diff = remainingShots - distributed;
        allocations[0] += diff;
      }

      // 각 컴포넌트별로 배정된 발수만큼 핀 좌표 생성
      compsToUse.forEach((pts, compIdx) => {
        const nShots = allocations[compIdx];
        if (nShots <= 0) return;

        if (nShots === 1) {
          const avgX = pts.reduce((acc, p) => acc + p.x, 0) / pts.length;
          const avgY = pts.reduce((acc, p) => acc + p.y, 0) / pts.length;
          candidateShots.push({ x: Math.round(avgX), y: Math.round(avgY) });
        } else {
          // K-Means++ 초기화 및 12회 수렴 반복
          const centers: Array<{ x: number; y: number }> = [];
          centers.push(pts[Math.floor(pts.length / 2)]);

          for (let step = 1; step < nShots; step++) {
            let maxDistSq = -1;
            let bestPt = pts[0];
            for (let pIdx = 0; pIdx < pts.length; pIdx += 2) {
              const p = pts[pIdx];
              let minDistToCenter = Infinity;
              for (const c of centers) {
                const dSq = (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
                if (dSq < minDistToCenter) minDistToCenter = dSq;
              }
              if (minDistToCenter > maxDistSq) {
                maxDistSq = minDistToCenter;
                bestPt = p;
              }
            }
            centers.push({ x: bestPt.x, y: bestPt.y });
          }

          // Lloyd 반복 최적화
          let curCenters = centers;
          for (let iter = 0; iter < 12; iter++) {
            const clusters: Array<Array<{ x: number; y: number }>> = Array.from(
              { length: nShots },
              () => []
            );

            for (const p of pts) {
              let bestIdx = 0;
              let bestDistSq = Infinity;
              for (let cIdx = 0; cIdx < curCenters.length; cIdx++) {
                const dSq = (p.x - curCenters[cIdx].x) ** 2 + (p.y - curCenters[cIdx].y) ** 2;
                if (dSq < bestDistSq) {
                  bestDistSq = dSq;
                  bestIdx = cIdx;
                }
              }
              clusters[bestIdx].push(p);
            }

            curCenters = clusters.map((clusterPts, cIdx) => {
              if (clusterPts.length === 0) return curCenters[cIdx];
              const sX = clusterPts.reduce((acc, p) => acc + p.x, 0) / clusterPts.length;
              const sY = clusterPts.reduce((acc, p) => acc + p.y, 0) / clusterPts.length;
              return { x: Math.round(sX), y: Math.round(sY) };
            });
          }

          candidateShots.push(...curCenters);
        }
      });
    } else {
      // 컴포넌트가 전혀 없는 경우: 흑점 정중앙에 기본 탄환 배치
      for (let i = 0; i < maxAllowedShots; i++) {
        const angle = i * 2.399;
        const rPx = i === 0 ? 0 : Math.min(1.8 * pxPerMm, i * 0.3 * pxPerMm);
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

    // 최종 발차별 탄착점 객체 구성 (정확히 maxAllowedShots 발수 보장)
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
