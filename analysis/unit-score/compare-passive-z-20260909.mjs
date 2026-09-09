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

export function compareZAndPlanAA(){
 const checkpoint='analysis/unit-score/experiments/baseline-passive-Z-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 for(const [p,h] of Object.entries(plan.newEvidenceHashes))assert.equal(hash(p),h);
 assert.equal(hash('analysis/unit-score/predict-passive-z-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/compare-passive-y-20260909.mjs'),plan.comparisonSourceSHA256);
 assert.equal(hash('analysis/unit-score/observations/Y-20260909.json'),plan.YObservationSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-passive-Y-20260909.json'),plan.YCheckpointSHA256);
 const observations=[...fixture.observations,...['M','O','P','Q','R','S','T','U','V','W','X','Y','Z'].map(id=>read(`analysis/unit-score/observations/${id}-20260909.json`))];
 const rows=observations.map(o=>{const f=displayedActiveFeatures(o);return {...f,quantized:quantizedSupportSP(f)};});
 const zo=observations.find(o=>o.sampleId==='Z'),wo=observations.find(o=>o.sampleId==='W');
 const z=rows.find(r=>r.id==='Z');
 assert.equal(zo.predictionCheckpointSHA256,checkpointHash);assert.equal(zo.leaderId,plan.leaderId);
 assert.deepEqual(zo.memberIds,plan.memberIds);assert.deepEqual(zo.profiles,plan.profiles);
 assert.equal(rows.length,24);assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 const distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;assert.equal(distinctMemberSets,15);
 const comparisons=[
  {item:'memberParameter',kind:'calculated',predicted:plan.features.power.memberParameter,observed:zo.game.powerDetail.memberParameter},
  {item:'active',kind:'research formula',predicted:plan.features.A,observed:zo.game.scoreBonusDetail.active},
  {item:'special',kind:'research formula',predicted:plan.quantized.display,observed:zo.game.scoreBonusDetail.special},
  {item:'passiveScore',kind:'invariance hypothesis',predicted:plan.hypotheses.passive.preferredDisplay,observed:zo.game.scoreBonusDetail.passive},
  {item:'boardScore',kind:'invariance hypothesis',predicted:plan.hypotheses.displayedBoard.display,observed:zo.game.scoreBonusDetail.board}
 ];
 for(const c of comparisons){c.matches=c.predicted===c.observed;assert.ok(c.matches);}
 assert.equal(zo.game.overallPower,null);assert.equal(zo.game.scoreBonusPct,null);
 assert.equal(zo.game.powerDetail.passive,null);assert.equal(zo.game.powerDetail.outfit,null);
 const sumOfSuppliedBonusRows=clean(Object.values(zo.game.scoreBonusDetail).filter(v=>v!==null).reduce((s,v)=>s+v,0));assert.equal(sumOfSuppliedBonusRows,127.1);
 const controls=['W','X','Y','Z'].map(id=>{
  const o=observations.find(o=>o.sampleId===id),r=rows.find(r=>r.id===id);
  assert.deepEqual(o.memberIds,zo.memberIds);assert.deepEqual(r.conditions.passiveSupport,z.conditions.passiveSupport);
  return {id,leaderId:o.leaderId,parameterConditionMet:r.conditions.leaderParameterConditionMet,
   reportedOutfitPower:o.game.powerDetail.outfit,predictedOutfitPower:r.power.outfit,
   relevantLeaderBoard:id==='W'?'Ririka support 13.3, judgement, conditional singer nodes':'User-confirmed absent for the leader character',
   memberParameter:o.game.powerDetail.memberParameter,...o.game.scoreBonusDetail};
 });
 assert.equal(controls[0].parameterConditionMet,false);assert.equal(controls[3].parameterConditionMet,false);
 assert.ok(controls.slice(1).every(r=>r.passive===1.5&&r.board===6.9));
 const deltaWminusZ={passive:clean(wo.game.scoreBonusDetail.passive-zo.game.scoreBonusDetail.passive),
  board:clean(wo.game.scoreBonusDetail.board-zo.game.scoreBonusDetail.board),
  active:clean(wo.game.scoreBonusDetail.active-zo.game.scoreBonusDetail.active),special:clean(wo.game.scoreBonusDetail.special-zo.game.scoreBonusDetail.special)};
 assert.deepEqual(deltaWminusZ,{passive:0.4,board:10.4,active:0,special:0});
 const nextIds=zo.memberIds.map(id=>id==='card-00022-5-uniq-0063-00'?'card-06002-5-uniq-0058-00':id);
 const nextObservation={sampleId:'AA',leaderId:zo.leaderId,memberIds:nextIds,
  profiles:[zo.leaderId,...nextIds].map(id=>({...fixture.profiles.find(p=>p.id===id)}))};
 const nf=displayedActiveFeatures(nextObservation),nsp=quantizedSupportSP(nf);
 assert.equal(nf.conditions.leaderParameterConditionMet,false);assert.equal(nf.conditions.leaderScoreSupport,0);
 assert.deepEqual(nf.conditions.passiveSupport,z.conditions.passiveSupport);
 const happyIds=ids=>ids.filter(id=>prepared.get(id).attribute===3).sort();
 assert.deepEqual(happyIds(nextIds),happyIds(zo.memberIds));assert.equal(happyIds(nextIds).length,2);
 for(const id of happyIds(nextIds))assert.deepEqual(nf.conditions.active.find(a=>a.id===id),z.conditions.active.find(a=>a.id===id));
 assert.equal(nf.A,71.1);assert.equal(nsp.display,42.2);assert.equal(nf.power.memberParameter,100252);assert.equal(nf.power.outfit,0);assert.equal(nf.power.passive,22531);
 assert.equal(nf.retainedPower,122783);assert.equal(nf.W,z.W);assert.equal(nf.rateSum,160);
 assert.ok(!rows.some(r=>[...r.memberIds].sort().join(',')===[...nextIds].sort().join(',')));
 assert.equal(hash(checkpoint),checkpointHash);assert.deepEqual(sourceLock(),plan.sourceHashes);
 return {recordedAt:new Date().toISOString(),scope:'Z validation with partial measurements, W/X/Y/Z leader control synthesis, and new-member baseline AA. No production formula change.',
  Z:{observation:zo,comparisons,
   unverifiedPowerPredictions:{overallRetained:plan.features.retainedPower,outfit:plan.features.power.outfit,passive:plan.features.power.passive,status:'Predictions only; not supplied by the user for Z.'},
   reportedOverallPower:null,reportedScoreBonus:null,sumOfSuppliedBonusRows,sumOfSuppliedNonBoardBonusRows:clean(sumOfSuppliedBonusRows-zo.game.scoreBonusDetail.board),
   derivedSumStatus:'Arithmetic sum of supplied rows, not confirmation of the omitted total or outfit row.',historicalCheckpointSHA256:checkpointHash,historyUnchanged:true,
   alternatePassive:{predicted:plan.hypotheses.alternatePassive.display,observed:zo.game.scoreBonusDetail.passive,matches:false}},
  controlSynthesis:{rows:controls,deltaWminusZ,
   conclusion:'For these five members, absent relevant leader-board effects give passive 1.5 and board 6.9 across both active Kanade parameter costumes and the inactive Suisei costume. W and Z have inactive costumes but differ by passive +0.4 and board +10.4 with Ririka leader context.',
   implication:'Ririka leader-board interaction is now the leading working explanation of the passive excess. Treat displayed-board-row subtraction as insufficient to guarantee passive independence.',
   limitations:['W versus Z also changes leader character, so the data do not prove causality of a particular node.',
    'The +0.4 passive excess is empirical for this one member set, not a reusable fixed correction.',
    'This controls parameter-only costumes. It does not establish independence from score-support costumes such as Ayame.',
    'Suisei/Kanade relevant leader boards are absent, but the members still have board effects. A fully board-free counterfactual was not measured.',
    'No 13.3% simple multiplier or unconditional singer 24% term has been adopted.']},
  summary:{observations:24,distinctMemberSets,activeMatches:24,refinedSPMatches:24,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberDiscriminatingMatch:'W',sameMemberLeaderChecks:['X','Y','Z']},
   passiveStatus:'A no-leader-support baseline of 1.5 is established for this member set; a general calculation remains unresolved.'},
  rows,next:{...nextObservation,features:nf,quantized:nsp,
   change:'Keep Z swimsuit Suisei leader and four members. Replace swimsuit Noel 80/1 with regular Kanade 80/0.',
   purpose:'Collect a second member-set baseline with the same leader, inactive costume, no relevant leader-board effects, and exactly the same two Happy recipients of Watame support.',
   fixed:'Watame passive support 8% to Watame and Raden; their Active profiles and Happy condition stay the same. No new score-support passive.',
   passiveHypothesis:{display:1.5,status:'Recipient-only invariance hypothesis, not a computed passive formula.',
    condition:'If the passive bonus depends only on the two recipients and their skills under this fixed leader, changing an unbuffed member leaves 1.5.'},
   boardPrediction:{display:null,reason:'Member character changes from Noel to Kanade and their board inputs differ; do not carry over the 6.9 invariance prediction.'},
   assumptions:'Regular Kanade SP combo >=100 and Raden life >=600 are treated as met. Leader member skills excluded. Active/SP baseline excludes boards.',
   limitations:'The replaced card changes Active, SP, parameter-passive effects, and member boards. A passive change would refute recipient-only invariance, but would not identify Active alone as its cause.',
   interpretation:{samePassive:'A second baseline with unchanged recipients supports recipient-only invariance at display precision, but does not determine a formula.',
    differentPassive:'Passive depends on additional composition context; compare the changed skill, parameter-passive and board inputs before attributing the cause.'},
   requestedMeasurements:'Member parameter, Active, SP, passive score and board score; power breakdown and totals if available. Preserve absent values as unreported.'},
  sourceHashes:sourceLock(),newEvidenceHashes:plan.newEvidenceHashes};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareZAndPlanAA(),null,2));
