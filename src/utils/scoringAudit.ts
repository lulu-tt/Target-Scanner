import { TargetCalibration } from '../types/target';
import { calculateShotScore, ISSF_AIR_RIFLE, printedRingRadiusMm } from './issfSpecs';

/** Full-ring gauge score, calculated from unrounded geometry, never from a rounded total. */
export function integerScoreAtDistance(distanceMm: number): number {
  if (!Number.isFinite(distanceMm) || distanceMm < 0) return 0;
  for (let ring = 10; ring >= 1; ring--) {
    if (distanceMm <= printedRingRadiusMm(ring) + ISSF_AIR_RIFLE.PELLET_RADIUS_MM + 1e-9) return ring;
  }
  return 0;
}
export function auditShotScore(point: { pixelX: number; pixelY: number; evidence?: { residualPx: number } }, c: TargetCalibration) {
  if (c.targetType === 'blank') return null;
  const distance = Math.hypot((point.pixelX - c.centerX) / c.pxPerMm, (point.pixelY - c.centerY) / (c.pxPerMmY ?? c.pxPerMm));
  const boundaryDistances = Array.from({ length: 10 }, (_, i) => printedRingRadiusMm(i + 1) + ISSF_AIR_RIFLE.PELLET_RADIUS_MM);
  const gapMm = Math.min(...boundaryDistances.map(r => Math.abs(distance - r)));
  // A review trigger from image sampling/edge-fit residual, NOT a confidence interval.
  const reviewPx = Math.max(1, point.evidence?.residualPx ?? 0);
  const reviewMm = reviewPx / Math.min(c.pxPerMm, c.pxPerMmY ?? c.pxPerMm);
  return { integer: integerScoreAtDistance(distance), decimal: calculateShotScore(point.pixelX, point.pixelY, c).score,
    distanceMm: distance, gapMm, needsReview: gapMm <= reviewMm,
    reviewLow: integerScoreAtDistance(distance + reviewMm), reviewHigh: integerScoreAtDistance(Math.max(0, distance - reviewMm)) };
}
export function integerScoreSummary(shots: { pixelX: number; pixelY: number }[], pins: { pixelX: number; pixelY: number }[], c: TargetCalibration) {
  if (c.targetType === 'blank') return null;
  const sum = (points: typeof shots) => points.reduce((s, p) => s + (auditShotScore(p, c)?.integer ?? 0), 0);
  const detected = sum(shots), estimated = sum(pins);
  return { detected, estimated, total: detected + estimated, count: shots.length + pins.length };
}
