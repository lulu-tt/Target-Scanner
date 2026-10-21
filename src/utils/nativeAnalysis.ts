import { ShotPoint, TargetCalibration } from '../types/target';
import { splitHoleComponents, UnresolvedRegion } from './overlapDetection';
import { calculateShotScore } from './issfSpecs';
/** Re-reads the source ROI at native pixel resolution; display coordinates remain 800px. */
export function analyzeNativeRegion(img: HTMLImageElement, calibration: TargetCalibration, coarseShots: ShotPoint[], coarseRegions: UnresolvedRegion[]) {
  const scale=Math.max(800/img.width,800/img.height), ox=(800-img.width*scale)/2,oy=(800-img.height*scale)/2;
  const points=[...coarseShots.map(s=>({x:s.pixelX,y:s.pixelY})),...coarseRegions.flatMap(r=>[{x:r.centerX-r.width/2,y:r.centerY-r.height/2},{x:r.centerX+r.width/2,y:r.centerY+r.height/2}])];
  const standard=calibration.targetType==='standard';
  if(!standard&&!points.length)return null;
  const margin=standard?calibration.blackRadiusPx*1.72:45;
  const left=standard?calibration.centerX-margin:Math.min(...points.map(p=>p.x))-margin;
  const top=standard?calibration.centerY-margin:Math.min(...points.map(p=>p.y))-margin;
  const right=standard?calibration.centerX+margin:Math.max(...points.map(p=>p.x))+margin;
  const bottom=standard?calibration.centerY+margin:Math.max(...points.map(p=>p.y))+margin;
  const x0=Math.max(0,Math.floor((left-ox)/scale)),y0=Math.max(0,Math.floor((top-oy)/scale));
  const w=Math.min(img.width-x0,Math.ceil((right-ox)/scale)-x0),h=Math.min(img.height-y0,Math.ceil((bottom-oy)/scale)-y0);
  if(w<=0||h<=0)return null;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(img,x0,y0,w,h,0,0,w,h);
  const data=ctx.getImageData(0,0,w,h).data,mask=new Uint8Array(w*h),visited=new Uint8Array(w*h);
  // Native 2-pixel sampling retains 2 source pixels rather than 2 downscaled display pixels.
  for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const n=(y*w+x)*4;mask[y*w+x]=((data[n+2]>data[n]+10&&data[n+2]>50)||(data[n+2]>data[n]+7&&data[n+2]>65))?1:0;}
  // Preserve native edges while rejecting thin handwriting using a source-scaled opening.
  const blue=mask.slice(),solid=new Uint8Array(w*h);
  const radius=Math.max(2,Math.round(4/scale/2)*2),delta=Math.max(2,Math.round(radius/4)*2);
  for(let y=radius;y<h-radius;y+=2)for(let x=radius;x<w-radius;x+=2){
    if(!blue[y*w+x])continue;let count=0;
    for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(blue[(y+dy*delta)*w+x+dx*delta])count++;
    if(count>=20)solid[y*w+x]=1;
  }
  const integral=new Uint32Array((w+1)*(h+1));
  for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=solid[y*w+x];integral[(y+1)*(w+1)+x+1]=integral[y*(w+1)+x+1]+row;}}
  for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const l=Math.max(0,x-radius),r=Math.min(w,x+radius+1),t=Math.max(0,y-radius),b=Math.min(h,y+radius+1);const n=integral[b*(w+1)+r]-integral[t*(w+1)+r]-integral[b*(w+1)+l]+integral[t*(w+1)+l];mask[y*w+x]=blue[y*w+x]&&n>0?1:0;}
  const components: {x:number;y:number}[][]=[];
  for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const seed=y*w+x;if(!mask[seed]||visited[seed])continue;
    const queue=[seed];visited[seed]=1;let edge=false;const pts=[];
    for(let k=0;k<queue.length;k++){const n=queue[k],cx=n%w,cy=Math.floor(n/w);pts.push({x:cx,y:cy});if(cx<2||cy<2||cx>=w-2||cy>=h-2)edge=true;
      for(let dy=-2;dy<=2;dy+=2)for(let dx=-2;dx<=2;dx+=2){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const j=ny*w+nx;if(mask[j]&&!visited[j]){visited[j]=1;queue.push(j);}}
    }
    if(edge||pts.length*4*scale*scale<200)continue;
    let lx=Infinity,rx=-Infinity,ty=Infinity,by0=-Infinity;for(const p of pts){lx=Math.min(lx,p.x);rx=Math.max(rx,p.x);ty=Math.min(ty,p.y);by0=Math.max(by0,p.y);}
    const bx=rx-lx+2,by=by0-ty+2;
    if(Math.min(bx,by)*scale<8||pts.length*4/(bx*by)<.25)continue;
    components.push(pts);
  }
  const fit=splitHoleComponents(components,standard?2.25*calibration.pxPerMm/scale:undefined);
  const mapX=(x:number)=>(x+x0)*scale+ox,mapY=(y:number)=>(y+y0)*scale+oy;
  const shots:ShotPoint[]=fit.fits.map((f,i)=>{const x=mapX(f.x),y=mapY(f.y),s=calculateShotScore(x,y,calibration);return {id:`shot-${i+1}`,shotNumber:i+1,pixelX:x,pixelY:y,offsetX_mm:s.offsetX_mm,offsetY_mm:s.offsetY_mm,distance_mm:s.distanceMm,score:s.score,detectionStatus:f.status,evidence:{componentId:f.componentId,visibleArcDeg:f.visibleArcDeg,residualPx:f.residualPx*scale}};});
  return {shots,regions:fit.regions.map(r=>{
    const points=components[Number(r.id.replace('region-',''))]??[];
    const occupied=new Set(points.map(p=>`${p.x},${p.y}`));
    let sum=0,n=0; const pinCandidates:{x:number;y:number}[]=[];
    if(fit.radiusPx)for(let k=0;k<points.length;k+=Math.max(8,Math.ceil(points.length/512))){
      const p=points[k];let inside=0;
      for(let a=0;a<8;a++){const x=Math.round((p.x+fit.radiusPx*.7*Math.cos(a*Math.PI/4))/2)*2,y=Math.round((p.y+fit.radiusPx*.7*Math.sin(a*Math.PI/4))/2)*2;if(occupied.has(`${x},${y}`))inside++;}
      if(inside>=7){pinCandidates.push({x:Math.round(mapX(p.x)*10)/10,y:Math.round(mapY(p.y)*10)/10});if(standard){sum+=calculateShotScore(mapX(p.x),mapY(p.y),calibration).score;n++;}}
    }
    return {...r,pinCandidates,areaPx2:r.areaPx2===undefined?undefined:r.areaPx2*scale*scale,referenceRadiusPx:r.referenceRadiusPx===undefined?undefined:r.referenceRadiusPx*scale,scoreEstimatePerShot:n?Math.round(sum/n*10)/10:undefined,centerX:mapX(r.centerX),centerY:mapY(r.centerY),width:r.width*scale,height:r.height*scale};
  }),radiusPx:fit.radiusPx===null?null:fit.radiusPx*scale,metadata:{sourceWidth:img.width,sourceHeight:img.height,roiWidth:w,roiHeight:h,sampleStep:2,native:true as const}};
}
