import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const b=await build({entryPoints:['src/utils/regionProposals.ts'],bundle:true,format:'esm',platform:'node',write:false});
const {proposeRegions,mergeRegionReviews}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const c={centerX:400,centerY:400,pxPerMm:10,targetType:'standard'};
const regions=[{id:'a',centerX:400,centerY:400,width:50,height:50,areaPx2:Math.PI*100*4,referenceRadiusPx:10,scoreEstimatePerShot:9.5,pinCandidates:[{x:400,y:400}]},{id:'b',centerX:450,centerY:400,width:30,height:30,areaPx2:Math.PI*100*2,referenceRadiusPx:10,scoreEstimatePerShot:8,pinCandidates:[{x:450,y:400}]}];
const shots=[{id:'1',score:10,evidence:{componentId:'a'}},{id:'2',score:10,evidence:{componentId:'b'}}];
test('Area proposals are populated without any target count',()=>{const r=proposeRegions(regions,shots,c,0);assert.ok(r[0].additionalCount>0);assert.equal(r[0].source,'auto-area');assert.equal(r[0].estimatedTotal,r[0].additionalCount*9.5);});
test('Default proposals do not blindly fill the requested count',()=>{const a=proposeRegions(regions,shots,c,20),b=proposeRegions(regions,shots,c,30);assert.deepEqual(a,b);assert.ok(a.reduce((s,r)=>s+r.additionalCount,0)<18);});
test('No regions or missing geometric evidence cannot create guesses',()=>{assert.deepEqual(proposeRegions([],shots,c,20,true),[]);assert.deepEqual(proposeRegions([{id:'bad'}],shots,c,20,true),[]);});
test('Count-conditioned proposal explicitly allocates the remaining count exactly',()=>{const a=proposeRegions(regions,shots,c,20,true);assert.equal(a.reduce((s,r)=>s+r.additionalCount,0),18);assert.ok(a.every(r=>r.source==='count-conditioned'));assert.equal(shots.length,2);});
test('Reported count below located count never adds shots',()=>assert.ok(proposeRegions(regions,shots,c,1,true).every(r=>r.additionalCount===0)));
test('Blank targets can receive count guesses but no automatic score',()=>assert.ok(proposeRegions(regions,shots,{...c,targetType:'blank'},20,true).every(r=>r.estimatedTotal===undefined)));
test('Manual corrections including zero are preserved; automatic rows are recomputed',()=>{const a=proposeRegions(regions,shots,c,20);const out=mergeRegionReviews(a,[{regionId:'a',additionalCount:0,source:'manual'},{regionId:'b',additionalCount:100,source:'auto-area'}]);assert.equal(out[0].additionalCount,0);assert.notEqual(out[1].additionalCount,100);});

test('A slightly ragged single hole is not automatically doubled',()=>{const r=proposeRegions([{...regions[0],areaPx2:Math.PI*100*1.2}],shots,c,10);assert.equal(r[0].additionalCount,0);});
test('Selected-count allocation prioritizes hole area outside detected disks',()=>{const rs=[{...regions[0],centerX:0,centerY:0,holeSamples:[{x:0,y:0}]},{...regions[1],centerX:50,centerY:0,holeSamples:[{x:50,y:0}]}];const ps=proposeRegions(rs,[{pixelX:0,pixelY:0}],c,5,true);assert.equal(ps[0].additionalCount,0);assert.equal(ps[1].additionalCount,4);});
test('Fully covered mask still supports selected-count overlap assumptions',()=>{const rs=[{...regions[0],holeSamples:[{x:400,y:400}]}];const ps=proposeRegions(rs,[{pixelX:400,pixelY:400}],c,10,true);assert.equal(ps[0].additionalCount,9);});
test('A covered hole with torn fringe waits while another region has an unoccupied center',()=>{const rs=[{...regions[0],pinCandidates:[{x:0,y:0}],holeSamples:[{x:11,y:0}]},{...regions[1],pinCandidates:[{x:50,y:0}],holeSamples:[{x:50,y:0}]}];const p=proposeRegions(rs,[{pixelX:0,pixelY:0}],c,5,true);assert.equal(p[0].additionalCount,0);assert.equal(p[1].additionalCount,4);});

test('Areas without interior pin support never consume a selected-count quota',()=>{for(const conditioned of [false,true])assert.deepEqual(proposeRegions([{...regions[0],pinCandidates:[]}],[],c,10,conditioned),[]);});
