import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { transformSync } from 'esbuild';
const source = fs.readFileSync(new URL('../src/utils/overlapDetection.ts', import.meta.url), 'utf8');
const { code } = transformSync(source, { loader: 'ts', format: 'esm' });
const { splitHoleComponents } = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function components(centers, radius=14) {
  const mask=new Set();
  for(let y=100;y<260;y+=2) for(let x=100;x<300;x+=2) if(centers.some(c=>Math.hypot(x-c.x,y-c.y)<=radius)) mask.add(`${x},${y}`);
  const out=[];
  while(mask.size) {
    const first=mask.values().next().value;mask.delete(first);const queue=[first],points=[];
    for(let head=0;head<queue.length;head++) {
      const [x,y]=queue[head].split(',').map(Number);points.push({x,y});
      for(let dy=-2;dy<=2;dy+=2) for(let dx=-2;dx<=2;dx+=2) {const key=`${x+dx},${y+dy}`;if(mask.delete(key))queue.push(key);}
    }
    out.push(points);
  }
  return out;
}
test('No image evidence returns no coordinates',()=>assert.equal(splitHoleComponents([],14).fits.length,0));
test('One round hole remains one detected shot',()=>{
  const r=splitHoleComponents(components([{x:160,y:160}]),14);
  assert.equal(r.fits.length,1);assert.equal(r.fits[0].status,'detected');assert.ok(Math.hypot(r.fits[0].x-160,r.fits[0].y-160)<1);
});
test('Two overlapping holes are separated from their visible arcs',()=>{
  const centers=[{x:160,y:160},{x:180,y:160}];const r=splitHoleComponents(components(centers),14);
  assert.equal(r.fits.length,2);assert.ok(r.fits.every(f=>f.status==='estimated'));
  for(const c of centers)assert.ok(r.fits.some(f=>Math.hypot(c.x-f.x,c.y-f.y)<=4));
});
test('Three overlapping holes recover three image-supported centers',()=>{
  const centers=[{x:160,y:160},{x:182,y:160},{x:171,y:180}];const r=splitHoleComponents(components(centers),14);
  assert.equal(r.fits.length,3);for(const c of centers)assert.ok(r.fits.some(f=>Math.hypot(c.x-f.x,c.y-f.y)<=4));
});
test('Ten perfectly coincident hits do not fabricate ten positions',()=>assert.equal(splitHoleComponents(components(Array.from({length:10},()=>({x:160,y:160}))),14).fits.length,1));
test('No reference size on a merged blank target remains unresolved',()=>{
  const r=splitHoleComponents(components([{x:160,y:160},{x:180,y:160}]));assert.equal(r.fits.length,0);assert.equal(r.regions.length,1);
});
test('Isolated holes establish a pixel radius for blank targets',()=>{
  const r=splitHoleComponents(components([{x:130,y:130},{x:180,y:180},{x:200,y:180}]));assert.equal(r.fits.length,3);assert.ok(r.radiusPx>12&&r.radiusPx<16);
});
test('Rectangle tear is not silently converted into circular shots',()=>{
  const points=[];for(let y=120;y<=200;y+=2)for(let x=120;x<=200;x+=2)points.push({x,y});
  const r=splitHoleComponents([points],14);assert.equal(r.fits.length,0);assert.equal(r.regions.length,1);
});
