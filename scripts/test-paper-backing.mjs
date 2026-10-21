import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const b=await build({entryPoints:['src/utils/paperBacking.ts'],bundle:true,format:'esm',platform:'node',write:false});
const {findPaperBacking}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
function scene(backing){const size=200,data=new Uint8ClampedArray(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){let rgb=backing;if(x>20&&x<180&&y>15&&y<185)rgb=[220,216,204];if(Math.hypot(x-100,y-100)<15)rgb=backing;if(x>40&&x<44&&y>40&&y<150)rgb=[30,35,70];const i=(y*size+x)*4;data.set([...rgb,255],i);}return findPaperBacking(data,size);}
for(const [name,rgb]of [['brown',[115,85,65]],['blue',[35,75,125]],['gray',[100,100,100]]])test(name+' backing locates a hole and rejects ink and outside paper',()=>{const m=scene(rgb);assert.ok(m);assert.ok(m.inside(100,100));assert.ok(!m.inside(5,100));assert.ok(m.matches(...rgb));assert.ok(!m.matches(220,216,204));assert.ok(!m.matches(30,35,70));assert.equal(m.roughHoles.length,1);assert.ok(m.roughHoles[0].every(p=>Math.hypot(p.x-100,p.y-100)<16));});
