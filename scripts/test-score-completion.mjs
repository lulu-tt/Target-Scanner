import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const load=async path=>{const b=await build({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'node'});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));};
const {completeScore,regionScoreRange}=await load('src/utils/scoreCompletion.ts');
const {fitPrintedRings}=await load('src/utils/ringCalibration.ts');
const c={centerX:400,centerY:400,blackRadiusPx:152.5,pxPerMm:10,pxPerMmY:10,targetType:'standard',verified:true};
const shots=[{score:9.5},{score:10}];
const regions=[{id:'r1',centerX:410,centerY:400,width:12,height:12}];
const score=(reviews=[],expected=3,cal=c,ack=true,total=null)=>completeScore(shots,regions,reviews,expected,cal,ack,total);
test('Incomplete count cannot finalize',()=>assert.equal(score().complete,false));
test('Additional count alone gives a range and remains provisional',()=>{const s=score([{regionId:'r1',additionalCount:1}]);assert.equal(s.count,3);assert.equal(s.complete,false);assert.ok(s.min<=s.max);});
test('User confirmed additional score completes count without adding coordinates',()=>{const s=score([{regionId:'r1',additionalCount:1,confirmedTotal:9.3}]);assert.equal(s.complete,true);assert.equal(s.total,28.8);assert.equal(shots.length,2);});
test('Overcount, invalid additional score, fractional count, unverified scale and missing acknowledgment block completion',()=>{
 for(const s of [score([{regionId:'r1',additionalCount:2,confirmedTotal:20}]),score([{regionId:'r1',additionalCount:1,confirmedTotal:12}]),score([{regionId:'r1',additionalCount:1.5,confirmedTotal:10}]),score([{regionId:'r1',additionalCount:1,confirmedTotal:10}],3,{...c,verified:false}),score([{regionId:'r1',additionalCount:1,confirmedTotal:10}],3,c,false)])assert.equal(s.complete,false);
});
test('Blank targets have no geometric score range',()=>{assert.equal(regionScoreRange(regions[0],{...c,targetType:'blank'}),null);assert.equal(score([{regionId:'r1',additionalCount:1,confirmedTotal:9}],3,{...c,targetType:'blank'}).complete,false);});
test('Explicit independently verified card total replaces, never adds, located total',()=>{const s=score([],10,{...c,targetType:'blank'},true,98);assert.equal(s.complete,true);assert.equal(s.total,98);assert.equal(s.override,true);});
test('Invalid card total, missing count or acknowledgment cannot complete',()=>{for(const s of [score([],10,c,true,110),score([],0,c,true,50),score([],10,c,false,90),score([],10,c,true,-1)])assert.equal(s.complete,false);});
test('Synthetic concentric ellipses recover center and independent scales',()=>{
 const size=800,data=new Uint8ClampedArray(size*size*4);const cx=403,cy=397,sx=9.8,sy=10.4;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const r=Math.hypot((x-cx)/sx,(y-cy)/sy);const dark=r<15.25||[17.75,20.25,22.75].some(v=>Math.abs(r-v)<.08);const n=(y*size+x)*4;data[n]=data[n+1]=data[n+2]=dark?25:230;data[n+3]=255;}
 const fit=fitPrintedRings(data,size,{...c,verified:false});assert.equal(fit.method,'multi-ring');assert.ok(Math.hypot(fit.centerX-cx,fit.centerY-cy)<2);assert.ok(Math.abs(fit.pxPerMm-sx)<.15);assert.ok(Math.abs(fit.pxPerMmY-sy)<.15);assert.equal(fit.verified,false);
});
const {calculateShotScore}=await load('src/utils/issfSpecs.ts');
test('Decimal score uses 0.25mm bins rather than rounding a continuous value',()=>{assert.equal(calculateShotScore(402.4,400,c).score,10.9);assert.equal(calculateShotScore(402.5,400,c).score,10.8);assert.equal(calculateShotScore(424.9,400,c).score,10);assert.equal(calculateShotScore(425,400,c).score,9.9);});
test('Vertical score respects independent ellipse scale',()=>{const e={...c,pxPerMmY:20};assert.equal(calculateShotScore(410,400,e).score,calculateShotScore(400,420,e).score);});

test('Automatic estimated total requires acknowledgment and invalid manual score cannot fall back to it',()=>{
 const auto=[{regionId:'r1',additionalCount:1,estimatedTotal:9.4,source:'auto-area'}];assert.equal(score(auto,3,c,false).complete,false);assert.equal(score(auto).complete,true);assert.equal(score(auto).total,28.9);assert.equal(score([{...auto[0],confirmedTotal:12}]).complete,false);
});
test('Full selected-count estimate is available before review and ring confirmation',()=>{const auto=[{regionId:'r1',additionalCount:1,estimatedTotal:9.4,source:'count-conditioned'}];const r=score(auto,3,{...c,verified:false},false);assert.equal(r.estimateReady,true);assert.equal(r.complete,false);assert.equal(r.imageScore,19.5);assert.equal(r.virtualScore,9.4);assert.equal(r.proposedTotal,28.9);});
test('No full estimate for overcount, missing score, invalid manual score or blank',()=>{for(const r of [score([{regionId:'r1',additionalCount:2,estimatedTotal:20}]),score([{regionId:'r1',additionalCount:1}]),score([{regionId:'r1',additionalCount:1,estimatedTotal:9,confirmedTotal:12}]),score([{regionId:'r1',additionalCount:1,estimatedTotal:9}],3,{...c,targetType:'blank'})])assert.equal(r.estimateReady,false);});
