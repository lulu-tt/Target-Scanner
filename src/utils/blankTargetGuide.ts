/** Relative spread in the normalized photo; no physical scale or assumed aiming point. */
export function blankTargetSpread(points: { pixelX: number; pixelY: number }[]) {
  const valid = points.filter(p => Number.isFinite(p.pixelX) && Number.isFinite(p.pixelY));
  if (valid.length < 2) return null;
  const width = Math.max(...valid.map(p => p.pixelX)) - Math.min(...valid.map(p => p.pixelX));
  const height = Math.max(...valid.map(p => p.pixelY)) - Math.min(...valid.map(p => p.pixelY));
  return { widthPercent: width / 8, heightPercent: height / 8,
    direction: width > height * 1.3 ? '가로 폭이 더 큼' : height > width * 1.3 ? '세로 폭이 더 큼' : '가로·세로 폭이 비슷함' };
}
