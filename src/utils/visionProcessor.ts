import { splitHoleComponents, UnresolvedRegion } from './overlapDetection';
/**
 * [브라우저 온디바이스 컴퓨터 비전 프로세서 v3.0 - AI 고도화 에디션]
 * 작성자: 코다리 개발부장 & 디자인 실장 영자
 * 의도:
 *   1. [형태학적 5x5 오프닝]: 1~2px 굵기의 볼펜 손글씨/코치 피드백 메모 억제
 *   2. [외곽 테이블 플러드필]: 표적지 밖 파란색 매트/바닥 노이즈 격리 제거
 *   3. [백지 표적지 스마트 자동 추적]: 흑점 없는 백지 표적지의 경우 실제 탄착군(클러스터) 중심 자동 피팅
 *   4. [28mm 사격 ROI 제한]: 상하단 메모(날짜, 평가 문구) 완전 배제 및 순수 탄환 구멍만 캡처
 *   5. 독립 구멍은 감지, 경계 원호로 분리한 중심은 추정으로 반환합니다.
 */

import { TargetCalibration, ShotPoint, TargetMode } from '../types/target';
import { ISSF_AIR_RIFLE, calculateShotScore } from './issfSpecs';

export interface VisionProcessResult {
  calibration: TargetCalibration;
  detectedShots: ShotPoint[];
  normalizedImageUrl: string;
  warnings?: string[];
  unresolvedRegions?: UnresolvedRegion[];
  holeRadiusPx?: number | null;
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
  // 목표 발수는 검출 근거가 아니므로 좌표 생성이나 분할에 사용하지 않습니다.

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

  // 3. 표적지 중앙 단일 연결 흑점(Bullseye) 초정밀 검출 (BFS Flood-Fill)
  // 어두운 무채색 픽셀 마스크 생성 (2px 다운샘플링 그리드: 400x400)
  const gSize = size / 2; // 400
  const isDarkGrid = new Uint8Array(gSize * gSize);
  for (let gy = 0; gy < gSize; gy++) {
    for (let gx = 0; gx < gSize; gx++) {
      const px = gx * 2;
      const py = gy * 2;
      const idx = (py * size + px) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 58 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
        isDarkGrid[gy * gSize + gx] = 1;
      }
    }
  }

  // 캔버스 중앙(200, 200)에서 가장 가까운 흑점 시드(Seed) 포인트 탐색
  const centerG = Math.floor(gSize / 2);
  let seedGx = -1;
  let seedGy = -1;
  let minSeedDist = Infinity;

  // 중앙 60% 영역 내에서 시드 포인트 탐색
  const searchLimit = Math.floor(gSize * 0.35);
  for (let gy = centerG - searchLimit; gy <= centerG + searchLimit; gy++) {
    for (let gx = centerG - searchLimit; gx <= centerG + searchLimit; gx++) {
      if (gy >= 0 && gy < gSize && gx >= 0 && gx < gSize) {
        if (isDarkGrid[gy * gSize + gx] === 1) {
          const d = Math.hypot(gx - centerG, gy - centerG);
          if (d < minSeedDist) {
            minSeedDist = d;
            seedGx = gx;
            seedGy = gy;
          }
        }
      }
    }
  }

  let centerX = size / 2;
  let centerY = size / 2;
  let blackRadiusPx = 244; // 기본 800px 샘플 표적지 규격 (~16.0 px/mm)
  let targetType: 'standard' | 'blank' = 'standard';

  // 시드 포인트를 찾았고 중앙과 가까운 경우 단일 연결 흑점 BFS 탐색
  if (seedGx !== -1 && minSeedDist < gSize * 0.30) {
    const visited = new Uint8Array(gSize * gSize);
    const queue = [seedGy * gSize + seedGx];
    visited[seedGy * gSize + seedGx] = 1;

    let minGx = seedGx;
    let maxGx = seedGx;
    let minGy = seedGy;
    let maxGy = seedGy;
    let componentSize = 0;

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const cgx = curr % gSize;
      const cgy = Math.floor(curr / gSize);
      componentSize++;

      if (cgx < minGx) minGx = cgx;
      if (cgx > maxGx) maxGx = cgx;
      if (cgy < minGy) minGy = cgy;
      if (cgy > maxGy) maxGy = cgy;

      // 4방향 + 총알 구멍 관통을 위한 2칸 점프 이웃 탐색
      const neighbors = [
        curr - 1, curr + 1, curr - gSize, curr + gSize,
        curr - 2, curr + 2, curr - gSize * 2, curr + gSize * 2,
      ];

      for (const n of neighbors) {
        if (n >= 0 && n < gSize * gSize && !visited[n] && isDarkGrid[n] === 1) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }

    // 800x800 원래 좌표계로 스케일 복원
    const foundCenterX = Math.round(((minGx + maxGx) / 2) * 2);
    const foundCenterY = Math.round(((minGy + maxGy) / 2) * 2);
    const foundRadius = Math.round((((maxGx - minGx) + (maxGy - minGy)) / 4) * 2);

    // 반경 40px(실제 원거리 촬영) ~ 340px(샘플 프리셋 및 근접 촬영) 수용
    if (componentSize > 200 && foundRadius >= 40 && foundRadius <= 340) {
      centerX = foundCenterX;
      centerY = foundCenterY;
      blackRadiusPx = foundRadius;
      targetType = 'standard';
    } else {
      targetType = 'blank';
    }
  } else {
    targetType = 'blank';
  }

  if (options?.mode === 'blank') targetType = 'blank';

  // ISSF 규격: 공기소총 흑점(4~10점 링) 직경은 정확히 30.5mm (반경 15.25mm)
  let pxPerMm = blackRadiusPx / ISSF_AIR_RIFLE.BLACK_CIRCLE_RADIUS_MM;

  const calibration: TargetCalibration = {
    centerX,
    centerY,
    blackRadiusPx,
    pxPerMm,
    targetType,
  };

  const detectedShots: ShotPoint[] = [];
  let unresolvedRegions: UnresolvedRegion[] = [];
  let holeRadiusPx: number | null = null;

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
        detectionStatus: 'detected',
        isManuallyAdjusted: false,
      });
    });
  } else {
    // [고도화 비전 파이프라인]

    // 1단계: 청색 관통 매트 후보 픽셀 맵 생성 (2px 스텝)
    const isBlue = new Uint8Array(size * size);
    for (let py = 0; py < size; py += 2) {
      for (let px = 0; px < size; px += 2) {
        const idx = (py * size + px) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        if ((b > r + 10 && b > 50) || (b > r + 7 && b > 65)) {
          isBlue[py * size + px] = 1;
        }
      }
    }

    // 2단계: 표적지 바깥의 외곽 테이블 플러드필 제거 (사각 테두리 8px 큐 탐색)
    const isBg = new Uint8Array(size * size);
    const queue: number[] = [];

    for (let x = 0; x < size; x += 2) {
      if (isBlue[x]) { isBg[x] = 1; queue.push(x); }
      const bottomIdx = (size - 2) * size + x;
      if (isBlue[bottomIdx]) { isBg[bottomIdx] = 1; queue.push(bottomIdx); }
    }
    for (let y = 0; y < size; y += 2) {
      const leftIdx = y * size;
      if (isBlue[leftIdx]) { isBg[leftIdx] = 1; queue.push(leftIdx); }
      const rightIdx = y * size + (size - 2);
      if (isBlue[rightIdx]) { isBg[rightIdx] = 1; queue.push(rightIdx); }
    }

    let qHead = 0;
    while (qHead < queue.length) {
      const curr = queue[qHead++];
      const cx = curr % size;
      const cy = Math.floor(curr / size);

      const neighbors = [
        curr - 2,
        curr + 2,
        curr - size * 2,
        curr + size * 2,
      ];

      for (let i = 0; i < 4; i++) {
        const nIdx = neighbors[i];
        const nx = nIdx % size;
        const ny = Math.floor(nIdx / size);
        if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
          if (isBlue[nIdx] && !isBg[nIdx]) {
            isBg[nIdx] = 1;
            queue.push(nIdx);
          }
        }
      }
    }

    // 3단계: [형태학적 5x5 오프닝] 볼펜 손글씨(두께 1~2px) 필터링
    // 4.5mm 탄환 구멍(직경 25~35px)은 내부 코어 면적이 넓어 5x5 전방위 픽셀이 꽉 차지만,
    // 볼펜 잉크 획은 1~2px 선이므로 5x5 윈도우에서 즉시 탈락됩니다.
    const isSolid = new Uint8Array(size * size);
    for (let py = 4; py < size - 4; py += 2) {
      for (let px = 4; px < size - 4; px += 2) {
        const idx = py * size + px;
        if (isBlue[idx] && !isBg[idx]) {
          let countSolid = 0;
          for (let dy = -4; dy <= 4; dy += 2) {
            for (let dx = -4; dx <= 4; dx += 2) {
              const checkIdx = (py + dy) * size + (px + dx);
              if (isBlue[checkIdx] && !isBg[checkIdx]) {
                countSolid++;
              }
            }
          }
          if (countSolid >= 20) {
            isSolid[idx] = 1;
          }
        }
      }
    }

    // 4단계: 유효 탄흔 픽셀 집합 복원
    const holeMask = new Uint8Array(size * size);
    for (let py = 4; py < size - 4; py += 2) {
      for (let px = 4; px < size - 4; px += 2) {
        const idx = py * size + px;
        if (isSolid[idx]) {
          for (let dy = -4; dy <= 4; dy += 2) {
            for (let dx = -4; dx <= 4; dx += 2) {
              const nIdx = (py + dy) * size + (px + dx);
              if (isBlue[nIdx] && !isBg[nIdx]) {
                holeMask[nIdx] = 1;
              }
            }
          }
        }
      }
    }

    // 5단계: 실제 2px 샘플 격자의 8방향 연결 성분을 구합니다.
    // 기존 12px 셀 병합은 떨어진 구멍까지 합쳤고, 복원 픽셀 중복은 면적을 부풀렸습니다.
    const visitedHoles = new Uint8Array(size * size);
    const components: Array<Array<{ x: number; y: number }>> = [];
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const seed = y * size + x;
        if (!holeMask[seed] || visitedHoles[seed]) continue;
        const pending = [seed];
        const points: Array<{ x: number; y: number }> = [];
        visitedHoles[seed] = 1;
        for (let head = 0; head < pending.length; head++) {
          const current = pending[head];
          const cx = current % size;
          const cy = Math.floor(current / size);
          points.push({ x: cx, y: cy });
          for (let dy = -2; dy <= 2; dy += 2) {
            for (let dx = -2; dx <= 2; dx += 2) {
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue;
              const next = ny * size + nx;
              if (holeMask[next] && !visitedHoles[next]) {
                visitedHoles[next] = 1;
                pending.push(next);
              }
            }
          }
        }
        components.push(points);
      }
    }

    // 중복 없는 샘플점 50개(이미지 면적 약 200px) 이상인 영역만 후보로 사용합니다.
    let validComponents = components
      .filter((pts) => pts.length >= 50)
      .sort((a, b) => b.length - a.length);

    // [백지 사격 스마트 자동 중심점 추적]
    if (targetType === 'blank' && validComponents.length > 0) {
      // 1. 최대 면적을 가진 메인 탄착군 클러스터 탐색
      const mainCluster = validComponents[0];
      const mainClusterX = Math.round(
        mainCluster.reduce((acc, p) => acc + p.x, 0) / mainCluster.length
      );
      const mainClusterY = Math.round(
        mainCluster.reduce((acc, p) => acc + p.y, 0) / mainCluster.length
      );

      // 2. 표적지의 중심을 엉뚱한 화면 중앙(400,400)이 아니라 실제 탄착군 중심으로 피팅!
      centerX = mainClusterX;
      centerY = mainClusterY;
      calibration.centerX = centerX;
      calibration.centerY = centerY;
    }

    // [엄격한 물리적 유효 사격 구역(ROI) 필터링 - 표준/백지 공통 적용]
    // ISSF 10m 공기소총: 1점 링 외곽 직경 45.5mm (반경 22.75mm)
    // 외곽의 연도("2011년"), 날짜("10/18"), 우상단 점수표, 하단 코치 메모는 중심으로부터 반경 35mm~70mm 이상 떨어져 있으므로 제외
    const maxRoiPx = targetType === 'standard'
      ? blackRadiusPx * 1.68 // 흑점(4점 링) 반경의 1.68배 = 약 25.6mm (1점 링 + 탄환 반경 여유)
      : 26.0 * pxPerMm;

    validComponents = validComponents.filter((comp) => {
      const avgX = comp.reduce((acc, p) => acc + p.x, 0) / comp.length;
      const avgY = comp.reduce((acc, p) => acc + p.y, 0) / comp.length;
      return Math.hypot(avgX - centerX, avgY - centerY) <= maxRoiPx;
    });

    const separated = splitHoleComponents(validComponents, targetType === 'standard' ? ISSF_AIR_RIFLE.PELLET_RADIUS_MM * pxPerMm : undefined);
    unresolvedRegions = separated.regions;
    holeRadiusPx = separated.radiusPx;
    calibration.holeRadiusPx = separated.radiusPx ?? undefined;
    const candidateShots = separated.fits;

    candidateShots.forEach((pos, idx) => {
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
        detectionStatus: pos.status,
        evidence: { componentId: pos.componentId, visibleArcDeg: pos.visibleArcDeg, residualPx: pos.residualPx },
        isManuallyAdjusted: false,
      });
    });
  }

  return {
    calibration,
    detectedShots,
    unresolvedRegions,
    holeRadiusPx,
    normalizedImageUrl: canvas.toDataURL('image/jpeg', 0.95),
    warnings: knownShots?.length ? [] : [
      '감지는 독립된 원형 구멍, 추정은 겹친 경계의 원호로 찾은 중심입니다. 추정은 실제 탄착 위치를 보장하지 않습니다. 미확정에는 위치를 만들거나 점수를 부여하지 않습니다.',
      ...(targetType === 'blank' ? ['백지 표적은 실제 길이 기준을 알 수 없어 mm와 점수에 임시 배율을 사용합니다.'] : []),
    ],
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
