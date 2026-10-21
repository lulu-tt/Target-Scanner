import { TargetCalibration } from '../types/target';
/** Fits several concentric printed rings, with independent horizontal/vertical scale.
 * Axis-aligned ellipse compensation is not a full projective camera calibration. */
export function fitPrintedRings(data: Uint8ClampedArray, size: number, initial: TargetCalibration): TargetCalibration {
  if (initial.targetType !== 'standard') return { ...initial, method: 'unscaled', verified: false };
  const lum = (x: number,y: number) => { const ix=Math.round(x),iy=Math.round(y); if(ix<0||iy<0||ix>=size||iy>=size)return NaN;const n=(iy*size+ix)*4;return (data[n]+data[n+1]+data[n+2])/3; };
  const radii=[15.25,17.75,20.25,22.75];
  const evidence=(cx:number,cy:number,sx:number,sy:number) => radii.map(r=>{
    let good=0,total=0,contrast=0;
    for(let a=0;a<96;a++){
      const t=a*Math.PI/48,c=Math.cos(t),s=Math.sin(t);
      const x=cx+r*sx*c,y=cy+r*sy*s;
      const v=lum(x,y),outer=lum(x+2*c,y+2*s),inner=lum(x-2*c,y-2*s);
      if(!Number.isFinite(v+outer+inner))continue;
      const d=r===15.25?outer-inner:(outer+inner)/2-v;
      total++;if(d>15)good++;contrast+=Math.max(0,Math.min(d,70));
    }
    return {support:good/Math.max(total,1),contrast:contrast/Math.max(total,1)};
  });
  const merit=(p:number[])=>evidence(p[0],p[1],p[2],p[3]).reduce((s,r)=>s+r.contrast,0);
  let p=[initial.centerX,initial.centerY,initial.pxPerMm,initial.pxPerMm];let best=merit(p);
  for(const dx of [-6,-3,0,3,6])for(const dy of [-6,-3,0,3,6])for(const ax of [.94,.96,.98,1,1.02,1.04,1.06])for(const ay of [.94,.96,.98,1,1.02,1.04,1.06]) {
    const q=[initial.centerX+dx,initial.centerY+dy,initial.pxPerMm*ax,initial.pxPerMm*ay];const score=merit(q);if(score>best){p=q;best=score;}
  }
  for(const step of [3,1,.35])for(let iter=0;iter<7;iter++){
    let changed=false;
    for(let axis=0;axis<4;axis++)for(const sign of [-1,1]){
      const q=[...p];q[axis]+=sign*step*(axis<2?1:initial.pxPerMm*.025);
      if(Math.hypot(q[0]-initial.centerX,q[1]-initial.centerY)>initial.blackRadiusPx*.15||q[2]<initial.pxPerMm*.8||q[2]>initial.pxPerMm*1.2||q[3]<initial.pxPerMm*.8||q[3]>initial.pxPerMm*1.2)continue;
      const score=merit(q);if(score>best){p=q;best=score;changed=true;}
    }if(!changed)break;
  }
  const rings=evidence(p[0],p[1],p[2],p[3]);const supported=rings.filter(r=>r.support>=.35).length;
  if(supported<3)return {...initial,method:'coarse',ringSupport:supported,verified:false};
  return {...initial,centerX:p[0],centerY:p[1],pxPerMm:p[2],pxPerMmY:p[3],blackRadiusPx:p[2]*15.25,method:'multi-ring',ringSupport:supported,verified:false};
}
