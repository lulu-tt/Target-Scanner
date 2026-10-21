import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';
const b=await build({entryPoints:['src/utils/estimatedImpactCenter.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {calculateEstimatedImpactCenter:calc,impactCenterLabel:label}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
const c={centerX:400,centerY:400,pxPerMm:10,pxPerMmY:20};const p=(x,y=400)=>({pixelX:x,pixelY:y});
test('All selected impacts including virtual pins have equal weight',()=>{const r=calc([p(300),p(400)],[p(500),p(600)],c,4);assert.equal(r.pixelX,450);assert.equal(r.count,4);assert.equal(r.virtualCount,2);assert.equal(r.complete,true);assert.equal(label(r),'4발 전체 추정 탄착중심');});
test('Independent vertical scale is used without premature coordinate rounding',()=>{const r=calc([p(400,410)],[p(401,430)],c,2);assert.equal(r.pixelX,400.5);assert.equal(r.x_mm,.05);assert.equal(r.y_mm,1);});
test('Moving and deleting virtual positions immediately changes the mean and completeness',()=>{const a=[p(300)];assert.equal(calc(a,[p(500)],c,2).pixelX,400);assert.equal(calc(a,[p(600)],c,2).pixelX,450);const r=calc(a,[],c,2);assert.equal(r.complete,false);assert.match(label(r),/부분/);assert.deepEqual(a,[p(300)]);});
test('Empty, single, excess and free-count cases are explicitly distinguished',()=>{assert.equal(calc([],[],c,10),null);assert.equal(calc([p(400)],[],c,1).complete,true);assert.match(label(calc([p(400),p(410)],[],c,1)),/발수 초과/);assert.match(label(calc([p(400)],[],c,0)),/등록 핀/);});
