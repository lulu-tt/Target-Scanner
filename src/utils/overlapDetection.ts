/** Image-evidence-only circle fitting. Expected shot count is deliberately not an input. */
export interface HolePixel { x: number; y: number }
export interface HoleFit {
  x: number;
  y: number;
  status: 'detected' | 'estimated';
  componentId: string;
  visibleArcDeg: number;
  residualPx: number;
}
export interface UnresolvedRegion {
  id: string;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  reason: string;
  areaPx2?: number;
  referenceRadiusPx?: number;
  scoreEstimatePerShot?: number;
  pinCandidates?: {x:number;y:number}[];
  holeSamples?: {x:number;y:number}[]; // Uniform samples of measured hole pixels, including edges.

}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const boundsOf = (points: HolePixel[]) => {
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const p of points) { left = Math.min(left, p.x); right = Math.max(right, p.x); top = Math.min(top, p.y); bottom = Math.max(bottom, p.y); }
  return { left, top, width: right - left + 2, height: bottom - top + 2 };
};

export function splitHoleComponents(components: HolePixel[][], physicalRadiusPx?: number) {
  const descriptions = components.map(points => {
    const bounds = boundsOf(points);
    const radius = Math.sqrt(points.length * 4 / Math.PI);
    const aspect = Math.max(bounds.width / bounds.height, bounds.height / bounds.width);
    const fill = points.length * 4 / (Math.PI * bounds.width * bounds.height / 4);
    return { points, bounds, radius, round: aspect < 1.45 && fill > .8 && fill < 1.2, reference: aspect < 1.25 && fill > .8 && fill < 1.15 };
  });
  const roundRadii = descriptions.filter(c => c.reference && (!physicalRadiusPx || (c.radius > physicalRadiusPx*.6 && c.radius < physicalRadiusPx*1.3))).map(c => c.radius);
  // Blank targets derive a pixel radius from isolated round holes, never the arbitrary mm scale.
  const radius = roundRadii.length ? median(roundRadii.filter(r => r <= Math.min(...roundRadii) * 1.35)) : physicalRadiusPx;
  const fits: HoleFit[] = [];
  const regions: UnresolvedRegion[] = [];
  if (!radius || !Number.isFinite(radius) || radius < 4) {
    for (const [i, c] of descriptions.entries()) regions.push({ id: `region-${i}`, centerX: c.bounds.left + c.bounds.width / 2, centerY: c.bounds.top + c.bounds.height / 2, width: c.bounds.width, height: c.bounds.height, reason: '분리 기준이 될 단일 구멍의 크기를 확인하지 못했습니다.' });
    return { fits, regions, radiusPx: null };
  }
  for (const [i, c] of descriptions.entries()) {
    const componentId = `region-${i}`;
    const occupied = new Set(c.points.map(p => `${p.x},${p.y}`));
    const boundary = c.points.filter(p => [[2,0],[-2,0],[0,2],[0,-2]].some(([dx,dy]) => !occupied.has(`${p.x+dx},${p.y+dy}`)));
    const normalWindow = Math.max(6, Math.round(radius * .45 / 2) * 2);
    const normals = boundary.map(p => {
      let sx=0,sy=0,n=0;
      for(let dy=-normalWindow;dy<=normalWindow;dy+=2) for(let dx=-normalWindow;dx<=normalWindow;dx+=2) if(occupied.has(`${p.x+dx},${p.y+dy}`)) { sx+=dx;sy+=dy;n++; }
      return { x:-sx/n, y:-sy/n };
    });
    const single = c.round && c.radius >= radius * .75 && c.radius <= radius * 1.2;
    if (single) {
      const x = c.points.reduce((sum,p) => sum+p.x,0) / c.points.length;
      const y = c.points.reduce((sum,p) => sum+p.y,0) / c.points.length;
      const residualPx = boundary.reduce((sum,p) => sum+Math.abs(Math.hypot(p.x-x,p.y-y)-c.radius),0)/boundary.length;
      fits.push({ x, y, status: 'detected', componentId, visibleArcDeg: 360, residualPx });
      continue;
    }
    if (c.points.length * 4 / (c.bounds.width * c.bounds.height) > .93) {
      regions.push({ id:componentId, centerX:c.bounds.left+c.bounds.width/2, centerY:c.bounds.top+c.bounds.height/2, width:c.bounds.width, height:c.bounds.height, reason:'직선형 찢김 영역입니다. 탄환의 원형 경계로 보기 어려워 위치를 확정하지 않았습니다.' });
      continue;
    }
    // Vote for centers on the reverse circle of each visible edge point (2px grid).
    const votes = new Map<string, { x: number; y: number; votes: number }>();
    for (const p of boundary) for (let angle = 0; angle < 72; angle++) {
      const theta = angle * Math.PI / 36;
      const x = Math.round((p.x-radius*Math.cos(theta))/2)*2;
      const y = Math.round((p.y-radius*Math.sin(theta))/2)*2;
      if (!occupied.has(`${x},${y}`)) continue;
      const key = `${x},${y}`;
      const vote = votes.get(key);
      if (vote) vote.votes++; else votes.set(key, { x, y, votes: 1 });
    }
    const candidates = [...votes.values()].sort((a,b) => b.votes-a.votes).slice(0,160);
    const explained = new Set<number>();
    const accepted: HoleFit[] = [];
    const refined: HoleFit[] = [];
    const tolerance = Math.max(2.1, radius * .16);
    for (;;) {
      let best: { fit: HoleFit; indices: number[]; merit: number } | undefined;
      for (const candidate of candidates) {
        if (accepted.some(p => Math.hypot(p.x-candidate.x,p.y-candidate.y) < radius*.8)) continue;
        const indices: number[] = [];
        const bins = new Set<number>();
        let residual = 0;
        boundary.forEach((p,index) => {
          const d = Math.hypot(p.x-candidate.x,p.y-candidate.y);
          const normal = normals[index];
          const alignment = ((p.x-candidate.x)*normal.x+(p.y-candidate.y)*normal.y)/(d*Math.hypot(normal.x,normal.y));
          if (!explained.has(index) && Math.abs(d-radius) <= tolerance && alignment > .88) {
            indices.push(index); residual += Math.abs(d-radius);
            bins.add(Math.floor((Math.atan2(p.y-candidate.y,p.x-candidate.x)+Math.PI)*36/(2*Math.PI))%36);
          }
        });
        if (indices.length < 12 || bins.size < 12) continue;
        let inside = 0;
        for (let a=0;a<36;a++) {
          const x=Math.round((candidate.x+radius*.7*Math.cos(a*Math.PI/18))/2)*2;
          const y=Math.round((candidate.y+radius*.7*Math.sin(a*Math.PI/18))/2)*2;
          if (occupied.has(`${x},${y}`)) inside++;
        }
        if (inside < 28) continue;
        const merit = bins.size + indices.length*.35 - residual/indices.length;
        if (!best || merit > best.merit) best = { fit: { x:candidate.x, y:candidate.y, status:'estimated', componentId, visibleArcDeg:bins.size*10, residualPx:residual/indices.length }, indices, merit };
      }
      if (!best) break;
      // Remove the 2px voting-grid quantization using only the accepted visible arc.
      // Keep the measured reference radius fixed; no desired score/count enters this fit.
      const origin = { x: best.fit.x, y: best.fit.y };
      let cx = origin.x, cy = origin.y;
      for (let iteration = 0; iteration < 8; iteration++) {
        let xx=0,xy=0,yy=0,bx=0,by=0;
        for (const index of best.indices) {
          const p=boundary[index], dx=cx-p.x,dy=cy-p.y,d=Math.hypot(dx,dy);
          if(d<1e-6)continue;
          const error=d-radius,weight=Math.min(1,tolerance/Math.max(Math.abs(error),1e-6)),gx=dx/d,gy=dy/d;
          xx+=weight*gx*gx;xy+=weight*gx*gy;yy+=weight*gy*gy;bx+=weight*gx*error;by+=weight*gy*error;
        }
        const determinant=xx*yy-xy*xy;
        if(determinant<1e-6)break;
        const dx=(yy*bx-xy*by)/determinant,dy=(xx*by-xy*bx)/determinant;
        const nx=cx-dx,ny=cy-dy;
        if(Math.hypot(nx-origin.x,ny-origin.y)>2||!occupied.has(`${Math.round(nx/2)*2},${Math.round(ny/2)*2}`))break;
        cx=nx;cy=ny;if(Math.hypot(dx,dy)<.001)break;
      }
      const arcError=(x:number,y:number)=>best!.indices.reduce((sum,index)=>{
        const error=Math.abs(Math.hypot(boundary[index].x-x,boundary[index].y-y)-radius);
        return sum+(error<=tolerance?error*error:2*tolerance*error-tolerance*tolerance);
      },0);
      if(arcError(cx,cy)>arcError(origin.x,origin.y)){cx=origin.x;cy=origin.y;}
      refined.push({...best.fit,x:cx,y:cy,residualPx:best.indices.reduce((sum,index)=>sum+Math.abs(Math.hypot(boundary[index].x-cx,boundary[index].y-cy)-radius),0)/best.indices.length});
      accepted.push(best.fit);
      best.indices.forEach(index => explained.add(index));
    }
    fits.push(...refined);
    // This is an image region, not a fabricated shot: it never enters scoring or MPI.
    regions.push({ areaPx2: c.points.length * 4, referenceRadiusPx: radius, id: componentId, centerX:c.bounds.left+c.bounds.width/2, centerY:c.bounds.top+c.bounds.height/2, width:c.bounds.width, height:c.bounds.height, reason: accepted.length ? `겹친 구멍에서 원호 근거가 있는 중심 ${accepted.length}개를 추정했습니다. 내부에 가려진 추가 탄착 위치는 미확정입니다.` : '구멍 경계가 부족해 개별 중심을 분리하지 못했습니다.' });
  }
  return { fits, regions, radiusPx: radius };
}
