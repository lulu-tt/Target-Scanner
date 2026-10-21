import { TargetCalibration } from '../types/target';

type Position = { pixelX: number; pixelY: number };
export interface EstimatedImpactCenter {
  pixelX: number;
  pixelY: number;
  x_mm: number;
  y_mm: number;
  count: number;
  expected: number;
  virtualCount: number;
  complete: boolean;
}
/** Equal weight per displayed impact, including schematic virtual positions. */
export function calculateEstimatedImpactCenter(shots: Position[], virtualPins: Position[], c: TargetCalibration, expected: number): EstimatedImpactCenter | null {
  const points = [...shots, ...virtualPins];
  if (!points.length) return null;
  const pixelX = points.reduce((sum, p) => sum + p.pixelX, 0) / points.length;
  const pixelY = points.reduce((sum, p) => sum + p.pixelY, 0) / points.length;
  return { pixelX, pixelY, x_mm: (pixelX - c.centerX) / c.pxPerMm,
    y_mm: (pixelY - c.centerY) / (c.pxPerMmY ?? c.pxPerMm),
    count: points.length, expected, virtualCount: virtualPins.length,
    complete: expected > 0 && points.length === expected };
}
export function impactCenterLabel(center: EstimatedImpactCenter) {
  if (center.complete) return `${center.expected}발 전체 추정 탄착중심`;
  if (center.expected > 0) return `${center.count > center.expected ? '발수 초과' : '부분'} 추정 탄착중심 (${center.count}/${center.expected}발)`;
  return `등록 핀 추정 탄착중심 (${center.count}개)`;
}
