import { ShotPoint } from '../types/target';
export function shotStatus(shot: ShotPoint) {
  return shot.isManuallyAdjusted ? 'manual' : shot.detectionStatus ?? 'legacy';
}
export const statusLabel = { detected: '감지', estimated: '감지', manual: '수동', legacy: '미검증 기록' };
export const statusColor = { detected: '#10b981', estimated: '#10b981', manual: '#6366f1', legacy: '#94a3b8' };
export function summarizeEvidence(shots: ShotPoint[], expectedCount: number) {
  return {
    detected: shots.filter(s => shotStatus(s) === 'detected').length,
    estimated: shots.filter(s => shotStatus(s) === 'estimated').length,
    manual: shots.filter(s => shotStatus(s) === 'manual').length,
    legacy: shots.filter(s => shotStatus(s) === 'legacy').length,
    unresolved: expectedCount > 0 ? Math.max(0, expectedCount - shots.length) : null,
    excess: expectedCount > 0 ? Math.max(0, shots.length - expectedCount) : 0,
  };
}

/** Presentation categories; original detection statuses remain intact for saved evidence. */
export function summarizeDisplayEvidence(shots: ShotPoint[], estimatedPinCount: number, expectedCount: number) {
  const source = summarizeEvidence(shots, expectedCount);
  return { ...source, detected: source.detected + source.estimated, estimated: estimatedPinCount,
    unresolved: expectedCount > 0 ? Math.max(0, expectedCount - shots.length - estimatedPinCount) : null,
    excess: expectedCount > 0 ? Math.max(0, shots.length + estimatedPinCount - expectedCount) : 0 };
}
