import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const b=await build({entryPoints:['src/utils/issfSpecs.ts'],bundle:true,format:'esm',platform:'node',write:false});
const {calculateShotScore,centerRing,printedRingRadiusMm}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const c={centerX:400,centerY:400,pxPerMm:10,pxPerMmY:8,targetType:'standard'};
const score=d=>calculateShotScore(400+d*10,400,c).score;
test('Printed outer ring diameters match the ISSF air rifle target',()=>{
 assert.deepEqual(Array.from({length:10},(_,i)=>printedRingRadiusMm(10-i)*2),[.5,5.5,10.5,15.5,20.5,25.5,30.5,35.5,40.5,45.5]);
});
test('Every integer boundary includes a touching 4.5mm pellet and drops outside',()=>{
 for(let ring=10;ring>=1;ring--){const radius=printedRingRadiusMm(ring)+2.25;assert.equal(score(radius),ring);assert.equal(score(radius-1e-5),ring);assert.equal(score(radius+1e-5),ring===1?0:ring-.1);}
});
test('All 99 decimal boundaries award the inward zone at the line',()=>{
 for(let bin=1;bin<=99;bin++){const higher=Math.round((11-bin*.1)*10)/10;assert.equal(score(bin*.25),higher);assert.equal(score(bin*.25+1e-5),Math.round((higher-.1)*10)/10);}
});
test('A miss never receives a fractional 0.x score',()=>{assert.equal(score(25),1);for(const d of [25.00001,25.25,26,27.24,28,100])assert.equal(score(d),0);});
test('Printed center ring and edge-based score are deliberately different',()=>{assert.equal(centerRing(11.99),5);assert.equal(score(11.99),6.2);assert.equal(centerRing(.25),10);assert.equal(centerRing(.25001),9);assert.equal(centerRing(22.75001),0);});
test('Scoring uses both calibrated axes before rounding',()=>{assert.equal(calculateShotScore(400,420,c).score,10);assert.equal(calculateShotScore(415,416,c).score,10);assert.equal(calculateShotScore(415.001,416,c).score,9.9);});
