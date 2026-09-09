import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture,prepared} from './validation-data.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(9));

export function compareY(){
 const checkpoint='analysis/unit-score/experiments/baseline-passive-Y-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 assert.equal(hash('analysis/unit-score/compare-passive-x-board-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-passive-X-20260909.json'),plan.XCheckpointSHA256);
 for(const [p,h] of Object.entries(plan.newEvidenceHashes))assert.equal(hash(p),h);
 const observations=[...fixture.observations,...['M','O','P','Q','R','S','T','U','V','W','X','Y'].map(id=>read(`analysis/unit-score/observations/${id}-20260909.json`))];
 const rows=observations.map(o=>{const f=displayedActiveFeatures(o);return {...f,quantized:quantizedSupportSP(f)};});
 const yo=observations.find(o=>o.sampleId==='Y'),xo=observations.find(o=>o.sampleId==='X'),wo=observations.find(o=>o.sampleId==='W');
 const y=rows.find(r=>r.id==='Y'),x=rows.find(r=>r.id==='X');
 assert.equal(yo.predictionCheckpointSHA256,checkpointHash);
 assert.deepEqual(yo.memberIds,plan.memberIds);assert.deepEqual(yo.profiles,plan.profiles);assert.equal(yo.leaderId,plan.leaderId);
 assert.equal(rows.length,23);assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 const distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;assert.equal(distinctMemberSets,15);
 const comparisons=['memberParameter','outfit','passive'].map(item=>({item,kind:'calculated',predicted:plan.features.power[item],observed:yo.game.powerDetail[item]}));
 comparisons.push({item:'retainedPower',kind:'calculated',predicted:plan.features.retainedPower,observed:yo.game.powerDetail.memberParameter+yo.game.powerDetail.outfit+yo.game.powerDetail.passive},
  {item:'active',kind:'research formula',predicted:plan.features.A,observed:yo.game.scoreBonusDetail.active},
  {item:'special',kind:'research formula',predicted:plan.quantized.display,observed:yo.game.scoreBonusDetail.special},
  {item:'passiveScore',kind:'invariance hypothesis; not a solved formula',predicted:plan.hypotheses.passive.display,observed:yo.game.scoreBonusDetail.passive},
  {item:'boardScore',kind:'invariance hypothesis; not a solved formula',predicted:plan.hypotheses.displayedBoard.display,observed:yo.game.scoreBonusDetail.board});
 for(const c of comparisons){c.matches=c.predicted===c.observed;assert.ok(c.matches);}
 const knownBonusSum=clean(Object.values(yo.game.scoreBonusDetail).filter(v=>v!==null).reduce((s,v)=>s+v,0));assert.equal(knownBonusSum,yo.game.scoreBonusPct);
 const xyDeltas={totalPower:yo.game.overallPower-xo.game.overallPower,memberParameter:yo.game.powerDetail.memberParameter-xo.game.powerDetail.memberParameter,
  outfitPower:yo.game.powerDetail.outfit-xo.game.powerDetail.outfit,passivePower:yo.game.powerDetail.passive-xo.game.powerDetail.passive,
  unreportedPowerAggregate:(yo.game.overallPower-y.retainedPower)-(xo.game.overallPower-x.retainedPower),
  scoreBonus:clean(yo.game.scoreBonusPct-xo.game.scoreBonusPct),
  ...Object.fromEntries(['active','special','passive','board'].map(k=>[k,clean(yo.game.scoreBonusDetail[k]-xo.game.scoreBonusDetail[k])]))};
 assert.deepEqual(xyDeltas,{totalPower:6032,memberParameter:0,outfitPower:5989,passivePower:0,unreportedPowerAggregate:43,scoreBonus:0,active:0,special:0,passive:0,board:0});
 assert.deepEqual(x.memberIds,y.memberIds);assert.deepEqual(x.conditions.passiveSupport,y.conditions.passiveSupport);
 assert.equal(prepared.get(xo.leaderId).characterId,prepared.get(yo.leaderId).characterId);
 const ratio=1+13.3/100;
 const naiveMultiplierDiagnostic=['ceil','round','floor'].map(mode=>{
  const interval=v=>mode==='ceil'?[v-.1,v]:mode==='round'?[v-.05,v+.05]:[v,v+.1];
  const base=interval(yo.game.scoreBonusDetail.passive),target=interval(wo.game.scoreBonusDetail.passive);
  return {mode,baseInterval:base,scaledInterval:base.map(v=>clean(v*ratio)),targetInterval:target,
   intervalsOverlap:base[1]*ratio>=target[0]&&base[0]*ratio<=target[1]};
 });
 assert.ok(naiveMultiplierDiagnostic.every(r=>!r.intervalsOverlap));
 assert.equal(hash(checkpoint),checkpointHash);assert.deepEqual(sourceLock(),plan.sourceHashes);
 return {recordedAt:new Date().toISOString(),scope:'Y same-character costume comparison with frozen predictions. No production formula change.',
  Y:{observation:yo,comparisons,retainedPower:y.retainedPower,excludedPowerAggregate:yo.game.overallPower-y.retainedPower,
   knownBonusSum,retainedBonus:clean(yo.game.scoreBonusPct-yo.game.scoreBonusDetail.board),historicalCheckpointSHA256:checkpointHash,historyUnchanged:true},
  XY:{deltas:xyDeltas,findings:['Performance +130% to sense +130% changed outfit power by 5989 without changing any supplied score-bonus row.',
   'The total power difference is 6032, not 5989; 43 belongs to the difference in unreported board/memory/enhancement aggregates, with no individual attribution.',
   'Passive 1.5 and displayed board 6.9 invariance hypotheses both match. These are not evaluations of solved passive/board formulas.'],
   limit:'Both costumes have active parameter effects. This supports this stat-distribution change, but does not eliminate an inactive-vs-active costume distinction or prove Ririka-board causality.'},
  WXY:[wo,xo,yo].map(o=>({id:o.sampleId,leaderId:o.leaderId,outfitPower:o.game.powerDetail.outfit,
   outfitPowerStatus:o.game.powerDetail.outfit===null?'unreported; inactive condition inferred from planned profile':'observed',
   active:o.game.scoreBonusDetail.active,special:o.game.scoreBonusDetail.special,passive:o.game.scoreBonusDetail.passive,board:o.game.scoreBonusDetail.board})),
  boardHypothesis:{status:'Leader-board/leader-character differences are a higher-priority explanation of W versus X/Y, not yet an identified mechanism.',
   remainingContrast:'W has an inactive parameter costume and Ririka leader boards. X/Y have active parameter costumes and no relevant Kanade leader boards.',
   simpleMultiplier:{formula:'rawPassive(W) = rawPassive(no-leader-board) * (1 + 13.3/100)',
    note:'A restricted retrospective check. Even allowing display rounding intervals, this factor alone cannot map 1.5 to 1.9. It does not exclude nonlinear interactions, judgement effects, or other leader context.',
    displayUsingRoundedInput:Math.ceil(1.5*ratio*10-1e-9)/10,diagnostics:naiveMultiplierDiagnostic}},
  summary:{observations:23,distinctMemberSets,activeMatches:23,refinedSPMatches:23,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberDiscriminatingMatch:'W',sameMemberLeaderChecks:['X','Y']},
   passiveStatus:'Y invariance holds; X prior 1.9 invariance remains a historical failure. General passive, board and outfit bonus formulas remain unresolved.'},
  rows,sourceHashes:sourceLock(),newEvidenceHashes:plan.newEvidenceHashes};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareY(),null,2));
