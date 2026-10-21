/** Photo-derived paper interior and backing color models. No expected count or score input. */
export interface BackingModel {
  inside: (x: number, y: number) => boolean;
  matches: (r: number, g: number, b: number) => boolean;
  blueBacking: boolean;
  roughHoles: { x: number; y: number }[][];
}
const median = (a: number[]) => { const s = a.sort((a,b)=>a-b); return s[Math.floor(s.length/2)] ?? 0; };
export function findPaperBacking(data: Uint8ClampedArray, size = 800): BackingModel | null {
  const step=2,n=Math.floor(size/step), samples:{r:number;g:number;b:number;l:number}[]=[];
  for(let y=0;y<size;y+=8)for(let x=0;x<size;x+=8){const k=(y*size+x)*4,r=data[k],g=data[k+1],b=data[k+2];samples.push({r,g,b,l:(r+g+b)/3});}
  samples.sort((a,b)=>b.l-a.l);const pale=samples.slice(0,Math.floor(samples.length*.4));
  const paper=[median(pale.map(p=>p.r)),median(pale.map(p=>p.g)),median(pale.map(p=>p.b))],paperLum=(paper[0]+paper[1]+paper[2])/3;
  if(paperLum<110)return null;
  const light=new Uint8Array(n*n),seen=new Uint8Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const k=(y*step*size+x*step)*4;const dist=Math.hypot(data[k]-paper[0],data[k+1]-paper[1],data[k+2]-paper[2]);if(dist<70&&(data[k]+data[k+1]+data[k+2])/3>paperLum*.65)light[y*n+x]=1;}
  let largest:number[]=[];
  for(let i=0;i<light.length;i++){if(!light[i]||seen[i])continue;const q=[i];seen[i]=1;for(let h=0;h<q.length;h++){const k=q[h],x=k%n,y=Math.floor(k/n);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,j=ny*n+nx;if(nx>=0&&ny>=0&&nx<n&&ny<n&&light[j]&&!seen[j]){seen[j]=1;q.push(j);}}}if(q.length>largest.length)largest=q;}
  if(largest.length<n*n*.15)return null;
  const left=new Int32Array(n).fill(n),right=new Int32Array(n).fill(-1),top=new Int32Array(n).fill(n),bottom=new Int32Array(n).fill(-1);
  for(const k of largest){const x=k%n,y=Math.floor(k/n);left[y]=Math.min(left[y],x);right[y]=Math.max(right[y],x);top[x]=Math.min(top[x],y);bottom[x]=Math.max(bottom[x],y);}
  // Only enclosed dark regions can be holes; exterior backing must not leak into the ROI.
  const exterior=new Uint8Array(n*n),queue:number[]=[];
  const enqueue=(i:number)=>{if(!light[i]&&!exterior[i]){exterior[i]=1;queue.push(i);}};
  for(let i=0;i<n;i++){enqueue(i);enqueue((n-1)*n+i);enqueue(i*n);enqueue(i*n+n-1);}
  for(let h=0;h<queue.length;h++){const i=queue[h],x=i%n,y=Math.floor(i/n);if(x>0)enqueue(i-1);if(x<n-1)enqueue(i+1);if(y>0)enqueue(i-n);if(y<n-1)enqueue(i+n);}
  const inside=(x:number,y:number,pad=4)=>{const gx=Math.round(x/step),gy=Math.round(y/step);return gx>=0&&gy>=0&&gx<n&&gy<n&&(pad<0||!exterior[gy*n+gx])&&gx>=left[gy]+pad&&gx<=right[gy]-pad&&gy>=top[gx]+pad&&gy<=bottom[gx]-pad;};
  const hull=(x:number,y:number)=>inside(x,y,-4);
  const buckets=new Map<string,{r:number;g:number;b:number;l:number}[]>();
  for(let y=4;y<size-4;y+=4)for(let x=4;x<size-4;x+=4){if(hull(x,y))continue;const k=(y*size+x)*4,r=data[k],g=data[k+1],b=data[k+2],sum=r+g+b;if(sum<45)continue;const key=`${Math.floor(r/sum*12)},${Math.floor(b/sum*12)}`;const arr=buckets.get(key)??[];arr.push({r,g,b,l:sum/3});buckets.set(key,arr);}
  const groups=[...buckets.values()].sort((a,b)=>b.length-a.length),max=groups[0]?.length??0;
  const models=groups.filter(a=>a.length>=Math.max(30,max*.12)).slice(0,5).map(a=>{const r=median(a.map(p=>p.r)),g=median(a.map(p=>p.g)),b=median(a.map(p=>p.b)),sum=r+g+b,ls=a.map(p=>p.l).sort((a,b)=>a-b);return {r:r/sum,b:b/sum,min:ls[Math.floor(ls.length*.1)]*.65,max:ls[Math.floor(ls.length*.9)]*1.45};});
  if(!models.length)return null;
  const matches=(r:number,g:number,b:number)=>{const sum=r+g+b,l=sum/3;if(sum<45||l>paperLum-30)return false;return models.some(m=>l>=m.min&&l<=m.max&&Math.hypot(r/sum-m.r,b/sum-m.b)<.065);};
  // Rough seeds are used only to select the native ROI, never as final shot positions.
  const mask=new Uint8Array(n*n),solid=new Uint8Array(n*n);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*step*size+x*step)*4;if(inside(x*step,y*step)&&matches(data[i],data[i+1],data[i+2]))mask[y*n+x]=1;}
  for(let y=3;y<n-3;y++)for(let x=3;x<n-3;x++){let count=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)count+=mask[(y+dy)*n+x+dx];if(count>=20)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(mask[(y+dy)*n+x+dx])solid[(y+dy)*n+x+dx]=1;}
  const visited=new Uint8Array(n*n),roughHoles:{x:number;y:number}[][]=[];
  for(let k=0;k<solid.length;k++){if(!solid[k]||visited[k])continue;const q=[k];visited[k]=1;for(let h=0;h<q.length;h++){const i=q[h],x=i%n,y=Math.floor(i/n);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy,j=ny*n+nx;if(nx>=0&&ny>=0&&nx<n&&ny<n&&solid[j]&&!visited[j]){visited[j]=1;q.push(j);}}}if(q.length*step*step>=180)roughHoles.push(q.map(i=>({x:(i%n)*step,y:Math.floor(i/n)*step})));}
  return {inside:(x,y)=>inside(x,y),matches,roughHoles,blueBacking:models.some(m=>m.b>m.r+.05)};
}
