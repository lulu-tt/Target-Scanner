/**
 * [실제 ISSF 10m 공기소총 표적지 시뮬레이터 & 테스트 샘플 생성기]
 * 작성자: 코다리 개발부장
 * 의도: 사용자가 실제 종이 표적지가 없는 상황에서도 즉시 1클릭으로 앱의
 *       인식, 채점, 미세조정 기능을 실감 나게 테스트할 수 있도록 Canvas 기반 고해상도 표적지를 생성합니다.
 */

import { ISSF_AIR_RIFLE } from './issfSpecs';

export interface SamplePreset {
  id: string;
  name: string;
  description: string;
  shotOffsetsMm: Array<{ x: number; y: number }>;
}

export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'expert-group',
    name: '🏆 엘리트 10발 (104점대)',
    description: '10점 링 안쪽에 초밀집된 국가대표급 집탄군',
    shotOffsetsMm: [
      { x: -0.15, y: -0.1 },
      { x: 0.2, y: 0.15 },
      { x: -0.05, y: 0.25 },
      { x: 0.1, y: -0.2 },
      { x: -0.25, y: 0.05 },
      { x: 0.3, y: -0.1 },
      { x: -0.1, y: 0.35 },
      { x: 0.05, y: 0.05 },
      { x: 0.15, y: 0.2 },
      { x: -0.2, y: -0.25 },
    ],
  },
  {
    id: 'drift-up-right',
    name: '🎯 우상탄 편차 10발 (영점 조절용)',
    description: '탄착군이 우측 상단으로 쏠려 영점 클릭 수정이 필요한 세션',
    shotOffsetsMm: [
      { x: 1.2, y: -1.4 },
      { x: 1.5, y: -1.2 },
      { x: 1.1, y: -1.6 },
      { x: 1.8, y: -1.3 },
      { x: 1.3, y: -1.1 },
      { x: 1.6, y: -1.5 },
      { x: 1.4, y: -1.7 },
      { x: 1.7, y: -1.4 },
      { x: 1.2, y: -1.3 },
      { x: 1.5, y: -1.6 },
    ],
  },
  {
    id: 'beginner-spread',
    name: '🎯 중등부 연습 10발 (분산형)',
    description: '8~10점대에 걸쳐 분산된 실전 훈련 세션',
    shotOffsetsMm: [
      { x: -1.8, y: 0.8 },
      { x: 0.4, y: -2.1 },
      { x: 2.2, y: 0.5 },
      { x: -0.5, y: 1.9 },
      { x: 1.1, y: 1.2 },
      { x: -1.3, y: -1.1 },
      { x: 0.2, y: -0.6 },
      { x: 1.8, y: -1.5 },
      { x: -2.1, y: -0.4 },
      { x: 0.9, y: 0.3 },
    ],
  },
];

/**
 * ISSF 공식 규격 기반 실제 표적지 Canvas 이미지 생성 (800x800)
 */
export function generateSampleTargetImage(preset: SamplePreset): Promise<string> {
  return new Promise((resolve) => {
    const size = 800;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve('');

    const center = size / 2;
    // 800px 캔버스에서 표적지의 1mm = 16.0 픽셀 (흑점 30.5mm = 488px)
    const pxPerMm = 16.0;

    // 1. 표적지 바탕색 (특유의 베이지/크림색 사격 카드지 질감)
    ctx.fillStyle = '#E8DFD0';
    ctx.fillRect(0, 0, size, size);

    // 미세한 종이 질감 노이즈
    for (let i = 0; i < 3000; i++) {
      const nx = Math.random() * size;
      const ny = Math.random() * size;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(nx, ny, 2, 2);
    }

    // 2. 바깥쪽 흰색 영역 링 (1~3점) 그리기
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 3; ring++) {
      // 1점: 45.5mm, 2점: 40.5mm, 3점: 35.5mm
      const ringDiameterMm = 45.5 - (ring - 1) * 5.0;
      const radiusPx = (ringDiameterMm / 2.0) * pxPerMm;

      ctx.beginPath();
      ctx.arc(center, center, radiusPx, 0, Math.PI * 2);
      ctx.stroke();

      // 링 번호 텍스트
      ctx.fillStyle = '#444444';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ring.toString(), center, center - radiusPx + 12);
      ctx.fillText(ring.toString(), center, center + radiusPx - 12);
      ctx.fillText(ring.toString(), center - radiusPx + 12, center);
      ctx.fillText(ring.toString(), center + radiusPx - 12, center);
    }

    // 3. 중앙 흑점(Black Bullseye) 영역 (4~9점 구역, 지름 30.5mm)
    const blackRadiusPx = (ISSF_AIR_RIFLE.BLACK_CIRCLE_RADIUS_MM) * pxPerMm;
    ctx.beginPath();
    ctx.arc(center, center, blackRadiusPx, 0, Math.PI * 2);
    ctx.fillStyle = '#1A1816';
    ctx.fill();

    // 4. 흑점 내부 흰색 동심원 (5~8점 링)
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    for (let ring = 4; ring <= 8; ring++) {
      const ringDiameterMm = 30.5 - (ring - 4) * 5.0;
      const radiusPx = (ringDiameterMm / 2.0) * pxPerMm;

      ctx.beginPath();
      ctx.arc(center, center, radiusPx, 0, Math.PI * 2);
      ctx.stroke();

      if (ring >= 5 && ring <= 8) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Arial';
        ctx.fillText(ring.toString(), center, center - radiusPx + 9);
        ctx.fillText(ring.toString(), center, center + radiusPx - 9);
      }
    }

    // 5. 10점 중앙 흰색 점 (지름 0.5mm = 약 8px)
    const tenRadiusPx = (ISSF_AIR_RIFLE.RING_10_DIAMETER_MM / 2.0) * pxPerMm;
    ctx.beginPath();
    ctx.arc(center, center, tenRadiusPx, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // 6. 4.5mm 탄흔 (구멍 뚫린 납탄 자국) 시뮬레이션
    const pelletRadiusPx = (ISSF_AIR_RIFLE.PELLET_RADIUS_MM) * pxPerMm; // ~36px

    preset.shotOffsetsMm.forEach((offset) => {
      const shotX = center + offset.x * pxPerMm;
      const shotY = center + offset.y * pxPerMm;

      // 탄흔 구멍: 뒤쪽 어두운 공간
      ctx.save();
      ctx.beginPath();
      ctx.arc(shotX, shotY, pelletRadiusPx, 0, Math.PI * 2);
      ctx.fillStyle = '#050505';
      ctx.fill();

      // 뚫린 종이 가장자리의 거친 납탄 마찰 자국 및 찢어진 테두리 (Lead ring)
      ctx.strokeStyle = 'rgba(70, 70, 70, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // 미세한 찢김 효과
      for (let j = 0; j < 8; j++) {
        const angle = (Math.PI * 2 * j) / 8 + Math.random() * 0.2;
        const tx = shotX + Math.cos(angle) * (pelletRadiusPx + 1.5);
        const ty = shotY + Math.sin(angle) * (pelletRadiusPx + 1.5);
        ctx.beginPath();
        ctx.arc(tx, ty, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(180, 170, 150, 0.8)';
        ctx.fill();
      }
      ctx.restore();
    });

    resolve(canvas.toDataURL('image/jpeg', 0.95));
  });
}
