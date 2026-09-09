import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture} from './validation-data.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {numericBoardResearch} from './compare-board-ae-20260909.mjs';
import {compareAFAndPlanAG,simplePassiveDiagnostics} from './compare-passive-af-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(9));

export function compareAGAndPlanAH(){
 const checkpoint='analysis/unit-score/experiments/baseline-passive-AG-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 for(const [p,h] of Object.entries({...plan.newEvidenceHashes,...plan.observationHashes,...plan.previousSourceLocks}))assert.equal(hash(p),h);
 assert.equal(hash('analysis/unit-score/compare-passive-af-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-passive-AF-20260909.json'),plan.AFCheckpointSHA256);
 const previous=compareAFAndPlanAG(),ag=read('analysis/unit-score/observations/AG-20260909.json');
 assert.equal(ag.predictionCheckpointSHA256,checkpointHash);assert.equal(ag.leaderId,plan.leaderId);assert.deepEqual(ag.memberIds,plan.memberIds);assert.deepEqual(ag.profiles,plan.profiles);
 assert.equal(ag.game.overallPower,null);assert.equal(ag.game.scoreBonusPct,null);
 const f=displayedActiveFeatures(ag),sp=quantizedSupportSP(f),b=numericBoardResearch(ag);
 const comparisons=[
  {item:'memberParameter',predicted:plan.features.power.memberParameter,observed:ag.game.powerDetail.memberParameter},
  {item:'passivePower',predicted:plan.features.power.passive,observed:ag.game.powerDetail.passive},
  {item:'active',predicted:plan.features.A,observed:ag.game.scoreBonusDetail.active},
  {item:'special',predicted:plan.quantized.display,observed:ag.game.scoreBonusDetail.special}
 ].map(c=>({...c,matches:c.predicted===c.observed}));assert.ok(comparisons.every(c=>c.matches));
 const rows=[...previous.rows,{...f,quantized:sp}],distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;
 assert.equal(rows.length,31);assert.equal(new Set(rows.map(r=>r.id)).size,31);assert.equal(distinctMemberSets,21);
 assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 assert.equal(plan.hypotheses.board.display,null);assert.equal(plan.hypotheses.passive.display,null);
 assert.equal(b.joint.reportedSum,7);assert.ok(plan.hypotheses.conditionalJoint.possibleDisplays.includes(b.joint.reportedSum));
 assert.equal(b.boardReference,4);assert.equal(b.passiveMarginalReference,2.9);assert.equal(b.boardMatches,false);
 const jointComparison={frozenPossibleDisplays:plan.hypotheses.conditionalJoint.possibleDisplays,observedSum:b.joint.reportedSum,compatible:true,
  status:'Second prospective positive-passive check of the conditional separate-ceil compatibility family, after AF. This is neither an exact sum formula nor an individual-category forecast success.'};
 const positiveRows=[...previous.extensionAudit.positivePassive.rows,b];assert.equal(positiveRows.length,16);assert.ok(positiveRows.every(r=>r.joint.compatible&&!r.boardMatches));
 const agDiagnostics=simplePassiveDiagnostics(ag);
 const spDiscriminator={observed:ag.game.scoreBonusDetail.special,
  frozenRoundedActive:plan.quantized.display,frozenRawActive:plan.features.rawActiveFlatRate.ceil,
  frozenDurationWeightedRate:plan.features.displayedActiveDurationRate.ceil,
  interpretation:'AG44.3 agrees with the existing rounded-Active input, while raw-Active44.2 and duration-weighted-rate44.5 fail. These diagnostics were present in the AG checkpoint. AG does not discriminate per-card support rounding because its support contributions are already exact at0.01.'};
 assert.equal(spDiscriminator.frozenRoundedActive,44.3);assert.equal(spDiscriminator.frozenRawActive,44.2);assert.equal(spDiscriminator.frozenDurationWeightedRate,44.5);
 const leaderId='card-06003-5-uniq-0059-00',nextObservation={sampleId:'AH',leaderId,memberIds:[...ag.memberIds],
  profiles:[leaderId,...ag.memberIds].map(id=>({... (ag.profiles.find(p=>p.id===id)??fixture.profiles.find(p=>p.id===id))}))};
 const nf=displayedActiveFeatures(nextObservation),nsp=quantizedSupportSP(nf),nb=numericBoardResearch(nextObservation);
 assert.deepEqual(nf.memberIds,f.memberIds);assert.deepEqual(nf.conditions,f.conditions);assert.deepEqual(nf.SP,f.SP);
 assert.deepEqual(nf.power,f.power);assert.equal(nf.power.memberParameter,86545);assert.equal(nf.power.passive,10772);assert.equal(nf.power.outfit,0);
 assert.equal(nf.retainedPower,97317);assert.equal(nf.A,74.6);assert.equal(nsp.display,44.3);
 assert.deepEqual(nf.conditions.passiveSupport,[0,0,0,9,9]);assert.equal(nf.conditions.leaderScoreSupport,0);assert.equal(nf.conditions.leaderParameterConditionMet,false);
 assert.deepEqual(nb.inputs,b.inputs);assert.equal(nb.leaderBoardSupport,13.3);assert.equal(b.leaderBoardSupport,0);
 assert.deepEqual(nb.joint.twoCeilPossibleSums,[17.4,17.5]);
 const rawLeaderDifference=nb.joint.rawCombined-b.joint.rawCombined;assert.ok(Math.abs(rawLeaderDifference-b.Braw*.133)<1e-9);
 const wzReference={memberSet:'W/Z',leaderChange:'Suisei Z -> Ririka W',board:{Z:6.9,W:17.3,delta:10.4},passive:{Z:1.5,W:1.9,delta:.4},
  relevance:'Same-member inactive-costume leader comparison already showed a passive change for Watame support8. AH checks another passive source/target set; neither+0.4 nor a ratio is adopted as a transferable coefficient.'};
 assert.deepEqual(sourceLock(),plan.sourceHashes);assert.equal(hash(checkpoint),checkpointHash);
 return {schemaVersion:1,recordedAt:new Date().toISOString(),scope:'AG Noel-support observation and frozen-checkpoint comparison; same-member inactive-costume Ririka leader AH plan. Research only.',
  observation:ag,comparisons,features:f,quantized:sp,numericBoardFeatures:b,jointComparison,spDiscriminator,
  individualComparison:{adoptedForecasts:{board:null,passive:null},observed:{board:5.3,passive:1.7},
   failedDiagnostic:{board:4,passive:2.9},conclusion:'The cumulative marginal split fails for the single Noel support9 case too. This is no longer only a Watame/Flare support8 issue; no individual allocation formula is established.'},
  arithmetic:{reportedOverallPower:null,reportedScoreBonus:null,memberPlusPassive:97317,sumOfConfirmedBonusRows:125.9,status:'Subtotals are derived, not reported overall totals.'},
  passiveSource:plan.passiveSource,diagnostics:{AG:agDiagnostics,
   priorSharedScaleRejection:previous.diagnostics.scaleIntersection,sharedPositiveScalePossible:false,
   limitation:'The prior four-case scale intersection is already empty; AG does not revive the rejected common-scale family. Diagnostic alternatives remain separate from the adopted Active model.'},
  extensionAudit:{zeroPassive:previous.extensionAudit.zeroPassive,positivePassive:{rows:positiveRows,total:16,individualBoardMatches:0,jointCompatible:16,
   evidence:{retrospectiveAtAFPlanning:14,prospectiveCompatibilityChecks:['AF','AG']},conclusion:'The joint compatibility family survives another passive source, while all16 simple board allocations fail.'}},
  summary:{observations:31,distinctMemberSets,activeMatches:31,refinedSPMatches:31,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberChecks:['W','AA','AB','AC','AD','AF','AG'],sameMemberLeaderChecks:['X','Y','Z','AE']},
   passiveStatus:'Individual passive/board allocation and Ayame score-support outfit remain unresolved.'},rows,
  next:{...nextObservation,features:nf,quantized:nsp,numericBoardFeatures:nb,
   changeFromCurrentAG:'Change only the leader: swimsuit Suisei60/0 -> Ririka40/0. Leave the same five member cards, growth, order and board unlocks.',
   purpose:'Compare Noel support9 under two leader-board contexts while both leaders have inactive costumes. This removes member-card changes from the AG/AH comparison.',
   fixed:{memberIds:ag.memberIds,memberProfiles:ag.profiles.filter(p=>ag.memberIds.includes(p.id)),memberBoardInputs:b.inputs,
    supportRecipients:plan.passiveSource.targetMemberIds,supportPerRecipient:9,bothCostumeConditionsOff:true,sameActiveSPConditions:true},
   leaderContext:{AG:{character:'Suisei',relatedLeaderBoards:'User-confirmed absent',costume:'Inactive'},
    AH:{character:'Ririka',unconditionalBoardSupport:13.3,judgement:'20-second trigger, low probability,7 seconds GOOD+ -> PERFECT; numeric probability unknown',
     singerSupport:24,singerCondition:'Excluded under the planned pre-song context',costume:'RegLOSS>=2 condition unmet; Raden is the sole RegLOSS member'}},
   hypotheses:{active:{display:nf.A,kind:'Existing board-excluded formula; member skills unchanged'},special:{display:nsp.display,kind:'Existing board-excluded formula; member skills unchanged'},
    board:{display:null,kind:'Individual allocation unresolved'},passive:{display:null,kind:'No transferable leader-context coefficient'},
    conditionalJoint:{possibleDisplays:[17.4,17.5],raw:nb.joint.rawCombined,kind:'Conditional raw-sum plus separate ceil0.1 compatibility family. Ririka support13.3 is modeled but judgement is unresolved; not an exact or individual forecast.'}},
   rawLeaderDifference,conditionalJointIncreaseFromObservedAG:[10.4,10.5],wzReference,
   diagnosticOnly:{boardReferenceWithoutSupport:nb.boardReference,cumulativeMarginalPassiveReference:nb.passiveMarginalReference,
    status:'The same simple split fails prior positive-passive observations; these references are not adopted predictions.'},
   interpretation:{ifPassiveChanges:'Leader context influences the passive display for this Noel-support member set even with costumes inactive. This does not separate Ririka support nodes from judgement nodes.',
    ifPassiveUnchanged:'Leader invariance would hold at display precision for this one set; it would not undo the W/Z difference or prove general independence.'},
   assumptions:'Same formation detail before song selection. Ririka40/0, Ayame40/0, Towa70/0, Raden70/1, regular Flare11/0 and Noel80/1. Keep all member board unlocks and order unchanged. Raden life600 and regular Flare combo40 assumed met as before.',
   limitations:'Changing leader changes multiple leader-board nodes together. Both score-support13.3 and an unquantified judgement node belong to Ririka, so a result cannot isolate13.3 alone. Singer effects remain conditional. Full power is not predicted because board/memory/enhancement totals were not supplied. The Ririka zero-passive extension still has the G0.1 mismatch.',
   requestedMeasurements:'Member parameter, passive power, Active, SP, and board/passive score separately. Total score bonus if available.'},
  provenance:{AGCheckpointSHA256:checkpointHash,AGObservationSHA256:hash('analysis/unit-score/observations/AG-20260909.json'),sourceHashes:sourceLock(),
   newEvidenceHashes:plan.newEvidenceHashes,previousObservationHashes:plan.observationHashes,
   previousSourceLocks:{...plan.previousSourceLocks,'analysis/unit-score/compare-passive-af-20260909.mjs':plan.analysisSourceSHA256},predictionsAndProductionUnchanged:true}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareAGAndPlanAH(),null,2));
