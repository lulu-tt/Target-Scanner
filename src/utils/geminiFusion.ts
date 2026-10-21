import { ShotPoint, TargetCalibration } from '../types/target';
import { UnresolvedRegion } from './overlapDetection';
import { calculateShotScore } from './issfSpecs';

/** Agreement is a consistency measure, never a measured accuracy percentage. */
export function fuseGeminiCandidates(local: ShotPoint[], ai: ShotPoint[], regions: UnresolvedRegion[], c: TargetCalibration) {
  const radius = c.holeRadiusPx ?? 2.25 * c.pxPerMm;
  const shots = [...local];
  const used = new Set<string>();
  let matched = 0, rejected = 0;
  for (const candidate of ai) {
    const near = local.filter(s => !used.has(s.id))
      .map(s => ({ s, d: Math.hypot(s.pixelX - candidate.pixelX, s.pixelY - candidate.pixelY) }))
      .sort((a, b) => a.d - b.d)[0];
    if (near && near.d <= radius * .75) {
      used.add(near.s.id); matched++; continue; // Keep image-fitted coordinates and their scores.
    }
    const region = regions.find(r => r.pinCandidates?.some(p =>
      Math.hypot(p.x - candidate.pixelX, p.y - candidate.pixelY) <= Math.max(1, radius * .25)));
    // An AI-only center must be supported by the native hole interior and be distinct.
    if (!region || shots.some(s => Math.hypot(s.pixelX - candidate.pixelX, s.pixelY - candidate.pixelY) < radius * .75)) {
      rejected++; continue;
    }
    const score = calculateShotScore(candidate.pixelX, candidate.pixelY, c);
    shots.push({ ...candidate, id: `gemini-${shots.length + 1}`, shotNumber: shots.length + 1,
      detectionStatus: 'estimated', score: score.score, distance_mm: score.distanceMm,
      offsetX_mm: score.offsetX_mm, offsetY_mm: score.offsetY_mm });
  }
  return { shots, matched, rejected, added: shots.length - local.length };
}
