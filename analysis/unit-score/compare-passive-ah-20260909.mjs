import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture} from './validation-data.mjs';
import {round1} from './dummy-model-lab.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {numericBoardResearch} from './compare-board-ae-20260909.mjs';
import {compareAGAndPlanAH} from './compare-passive-ag-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(12));
const obsPath=id=>`analysis/unit-score/observations/${id}-20260909${id==='Z'?'-completed':''}.json`;

export function leaderConversionFamily(pairs,inputDisplay){
 const intervals=pairs.map(p=>{
  const x=Math.round(p.basePassive*10),y=Math.round(p.leaderPassive*10);
  return {baseId:p.baseId,leaderId:p.leaderId,basePassive:p.basePassive,leaderPassive:p.leaderPassive,
   lowerExclusive:(y-1)/x,upperInclusive:y/x};
 });
 const intersection={lowerExclusive:Math.max(...intervals.map(i=>i.lowerExclusive)),upperInclusive:Math.min(...intervals.map(i=>i.upperInclusive))};
 assert.ok(intersection.lowerExclusive<intersection.upperInclusive);
 const outputRawInterval={lowerExclusive:inputDisplay*intersection.lowerExclusive,upperInclusive:inputDisplay*intersection.upperInclusive};
 const displayAtLower=round1(outputRawInterval.lowerExclusive),displayAtUpper=round1(outputRawInterval.upperInclusive);
 // AI bounds lie strictly inside one ceil0.1 bin, so the exclusive lower endpoint causes no ambiguity here.
 assert.equal(displayAtLower,displayAtUpper);
 const plain133=pairs.map(p=>({baseId:p.baseId,leaderId:p.leaderId,fromDisplayed:round1(p.basePassive*1.133),observed:p.leaderPassive,
  fromLatentRawBounds:{lowerExclusive:clean((p.basePassive-.1)*1.133),upperInclusive:clean(p.basePassive*1.133)},
  possibleFromLatentRaw:Array.from({length:50},(_,i)=>i/10).filter(y=>y>clean((p.basePassive-.1)*1.133)&&clean(y-.1)<clean(p.basePassive*1.133))}));
 assert.ok(plain133.every(r=>r.fromDisplayed!==r.observed&&!r.possibleFromLatentRaw.includes(r.observed)));
 const displayedAddIntervals=pairs.map(p=>({lowerExclusive:clean(p.leaderPassive-.1-p.basePassive),upperInclusive:clean(p.leaderPassive-p.basePassive)}));
 const displayedAddIntersection={lowerExclusive:Math.max(...displayedAddIntervals.map(i=>i.lowerExclusive)),upperInclusive:Math.min(...displayedAddIntervals.map(i=>i.upperInclusive))};
 assert.ok(displayedAddIntersection.lowerExclusive>=displayedAddIntersection.upperInclusive);
 const latentMultiplier={lowerExclusive:Math.max(...pairs.map(p=>(Math.round(p.leaderPassive*10)-1)/Math.round(p.basePassive*10))),
  upperExclusive:Math.min(...pairs.map(p=>Math.round(p.leaderPassive*10)/(Math.round(p.basePassive*10)-1)))};
 const latentAdd={lowerExclusive:Math.max(...pairs.map(p=>clean(p.leaderPassive-.1-p.basePassive))),
  upperExclusive:Math.min(...pairs.map(p=>clean(p.leaderPassive-(p.basePassive-.1))))};
 const displaysBetween=(lo,hi)=>Array.from({length:100},(_,i)=>i/10).filter(y=>y>clean(lo)&&clean(y-.1)<clean(hi));
 const latentAlternatives={
  commonRawMultiplier:{coefficientInterval:latentMultiplier,possibleAI:displaysBetween((inputDisplay-.1)*latentMultiplier.lowerExclusive,inputDisplay*latentMultiplier.upperExclusive)},
  commonRawAddend:{coefficientInterval:latentAdd,possibleAI:displaysBetween((inputDisplay-.1)+latentAdd.lowerExclusive,inputDisplay+latentAdd.upperExclusive)}
 };
 assert.deepEqual(latentAlternatives.commonRawMultiplier.possibleAI,[2.2,2.3,2.4,2.5]);
 assert.deepEqual(latentAlternatives.commonRawAddend.possibleAI,[2.2,2.3]);
 return {formula:'P_Ririka = ceil0.1(k * P_Suisei_displayed)',intervals,intersection,
  inputDisplay,outputRawInterval,display:displayAtUpper,
  status:'New post-AH empirical conversion family fitted to two leader pairs; not a baseline passive formula or a mechanistic derivation from leader support13.3.',
  evidence:{retrospectivePairs:pairs.map(p=>[p.baseId,p.leaderId]),prospectiveSuccesses:0},
  plain133,displayedAddIntersection,latentAlternatives,
  limitations:['The input is an already measured displayed passive value, not a computed latent passive amount.',
   'Many coefficients in the interval fit; no single value such as1.25 or1.266 is identified.',
   'A new2.3 match would not uniquely establish this family: latent raw additive/multiplicative alternatives can also yield2.3.',
   'This differs from the previously rejected common scale on the board-adjusted raw passive margin; that earlier family stays rejected.',
   'Both leader pairs change Ririka support and judgement nodes together; neither the exact node nor an internal calculation order is identified.']};
}

export function compareAHAndPlanAI(){
 const checkpoint='analysis/unit-score/experiments/baseline-passive-AH-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 for(const [p,h] of Object.entries({...plan.newEvidenceHashes,...plan.observationHashes,...plan.previousSourceLocks}))assert.equal(hash(p),h);
 assert.equal(hash('analysis/unit-score/compare-passive-ag-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-passive-AG-20260909.json'),plan.AGCheckpointSHA256);
 const previous=compareAGAndPlanAH(),ah=read(obsPath('AH')),ag=read(obsPath('AG'));
 assert.equal(ah.predictionCheckpointSHA256,checkpointHash);assert.equal(ah.leaderId,plan.leaderId);assert.deepEqual(ah.memberIds,plan.memberIds);assert.deepEqual(ah.profiles,plan.profiles);
 assert.equal(ah.game.overallPower,null);assert.equal(ah.game.scoreBonusPct,null);
 const f=displayedActiveFeatures(ah),sp=quantizedSupportSP(f),b=numericBoardResearch(ah),agf=displayedActiveFeatures(ag);
 assert.deepEqual(f.conditions,agf.conditions);assert.deepEqual(f.memberIds,agf.memberIds);assert.deepEqual(f.power,agf.power);
 const comparisons=[
  {item:'memberParameter',predicted:plan.features.power.memberParameter,observed:ah.game.powerDetail.memberParameter},
  {item:'passivePower',predicted:plan.features.power.passive,observed:ah.game.powerDetail.passive},
  {item:'active',predicted:plan.features.A,observed:ah.game.scoreBonusDetail.active},
  {item:'special',predicted:plan.quantized.display,observed:ah.game.scoreBonusDetail.special}
 ].map(c=>({...c,matches:c.predicted===c.observed}));assert.ok(comparisons.every(c=>c.matches));
 const rows=[...previous.rows,{...f,quantized:sp}],distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;
 assert.equal(rows.length,32);assert.equal(new Set(rows.map(r=>r.id)).size,32);assert.equal(distinctMemberSets,21);
 assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 assert.equal(plan.hypotheses.board.display,null);assert.equal(plan.hypotheses.passive.display,null);
 assert.equal(b.joint.reportedSum,17.5);assert.ok(plan.hypotheses.conditionalJoint.possibleDisplays.includes(b.joint.reportedSum));
 assert.equal(b.boardReference,14.4);assert.equal(b.passiveMarginalReference,3);assert.equal(b.boardMatches,false);
 const delta={board:clean(ah.game.scoreBonusDetail.board-ag.game.scoreBonusDetail.board),passive:clean(ah.game.scoreBonusDetail.passive-ag.game.scoreBonusDetail.passive),
  joint:clean(b.joint.reportedSum-previous.numericBoardFeatures.joint.reportedSum),active:clean(f.A-agf.A),special:clean(sp.display-quantizedSupportSP(agf).display)};
 assert.deepEqual(delta,{board:10,passive:.5,joint:10.5,active:0,special:0});
 const positiveRows=[...previous.extensionAudit.positivePassive.rows,b];assert.equal(positiveRows.length,17);assert.ok(positiveRows.every(r=>r.joint.compatible&&!r.boardMatches));
 const pairs=[['Z','W'],['AG','AH']].map(([baseId,leaderId])=>{
  const base=read(obsPath(baseId)),leader=read(obsPath(leaderId)),bf=displayedActiveFeatures(base),lf=displayedActiveFeatures(leader);
  assert.deepEqual(base.memberIds,leader.memberIds);assert.deepEqual(bf.conditions,lf.conditions);assert.equal(lf.conditions.leaderParameterConditionMet,false);
  for(const id of base.memberIds)assert.deepEqual(base.profiles.find(p=>p.id===id),leader.profiles.find(p=>p.id===id));
  return {baseId,leaderId,basePassive:base.game.scoreBonusDetail.passive,leaderPassive:leader.game.scoreBonusDetail.passive,
   baseBoard:base.game.scoreBonusDetail.board,leaderBoard:leader.game.scoreBonusDetail.board,
   passiveDelta:clean(leader.game.scoreBonusDetail.passive-base.game.scoreBonusDetail.passive),bothCostumesOff:true,sameMembers:true};
 });
 const ab=read(obsPath('AB')),abf=displayedActiveFeatures(ab),leaderId=ah.leaderId;
 const nextObservation={sampleId:'AI',leaderId,memberIds:[...ab.memberIds],profiles:[leaderId,...ab.memberIds].map(id=>({... (ab.profiles.find(p=>p.id===id)??fixture.profiles.find(p=>p.id===id))}))};
 const nf=displayedActiveFeatures(nextObservation),nsp=quantizedSupportSP(nf),nb=numericBoardResearch(nextObservation);
 assert.deepEqual(nf.conditions,abf.conditions);assert.deepEqual(nf.power,abf.power);assert.deepEqual(nb.inputs,numericBoardResearch(ab).inputs);
 assert.equal(nf.power.memberParameter,84026);assert.equal(nf.power.passive,13617);assert.equal(nf.power.outfit,0);assert.equal(nf.retainedPower,97643);
 assert.equal(nf.A,73.7);assert.equal(nsp.display,43.6);assert.deepEqual(nf.conditions.passiveSupport,[0,0,8,0,8]);
 assert.deepEqual(nb.joint.twoCeilPossibleSums,[17.8,17.9]);
 const conversion=leaderConversionFamily(pairs,ab.game.scoreBonusDetail.passive);assert.equal(conversion.display,2.3);
 const conditionalBoardCandidates=nb.joint.twoCeilPossibleSums.map(s=>clean(s-conversion.display));assert.deepEqual(conditionalBoardCandidates,[15.5,15.6]);
 assert.deepEqual(nextObservation.memberIds,ah.memberIds.map(id=>id==='card-00022-5-uniq-0063-00'?'card-00026-5-uniq-0065-00':id));
 assert.deepEqual(sourceLock(),plan.sourceHashes);assert.equal(hash(checkpoint),checkpointHash);
 return {schemaVersion:1,recordedAt:new Date().toISOString(),scope:'AH measured leader effect with inactive costumes; new displayed-passive conversion family and first independent AI check. Research only.',
  observation:ah,comparisons,features:f,quantized:sp,numericBoardFeatures:b,
  jointComparison:{frozenPossibleDisplays:plan.hypotheses.conditionalJoint.possibleDisplays,observedSum:17.5,compatible:true,
   status:'Third prospective positive-passive conditional-sum check after AF/AG; no individual forecast was made.'},
  individualComparison:{adoptedForecasts:{board:null,passive:null},observed:{board:15.3,passive:2.2},failedDiagnostic:{board:14.4,passive:3}},
  leaderPair:{base:'AG',changedLeader:'AH',delta,
   conclusion:'The Noel support9 member set has a passive display increase0.5 with both costumes inactive and member conditions fixed. Leader context matters for this display; it cannot be attributed to costume support.',
   limitation:'This does not separate Ririka support13.3 from its judgement node or identify an internal formula.'},
  leaderPairs:pairs,leaderConversion:conversion,
  arithmetic:{reportedOverallPower:null,reportedScoreBonus:null,memberPlusPassive:97317,sumOfConfirmedBonusRows:136.4,status:'Derived subtotals only; overall totals remain unreported.'},
  extensionAudit:{zeroPassive:previous.extensionAudit.zeroPassive,positivePassive:{rows:positiveRows,total:17,individualBoardMatches:0,jointCompatible:17,
   evidence:{retrospectiveAtAFPlanning:14,prospectiveCompatibilityChecks:['AF','AG','AH']},conclusion:'Joint compatibility survives; the simple individual split still fails all17.'}},
  summary:{observations:32,distinctMemberSets,activeMatches:32,refinedSPMatches:32,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberChecks:['W','AA','AB','AC','AD','AF','AG'],sameMemberLeaderChecks:['X','Y','Z','AE','AH']},
   passiveStatus:'Baseline passive/board allocation and Ayame outfit formula unresolved. The new leader conversion family is only a testable empirical candidate.'},rows,
  next:{...nextObservation,features:nf,quantized:nsp,numericBoardFeatures:nb,
   changeFromCurrentAH:'Replace swimsuit Noel80/1 with swimsuit Watame70/1; keep Ririka40/0 leader, Ayame40/0, Towa70/0, Raden70/1 and regular Flare11/0.',
   controlReference:'AB',changeFromAB:'Only leader changes: swimsuit Suisei60/0 -> Ririka40/0; the same five members/profiles/boards/order.',
   purpose:'First new test of the post-AH leader conversion using AB measured passive1.8. Both AB and AI costumes are inactive and exactly two Happy recipients Raden/Watame receive support8.',
   hypotheses:{active:{display:nf.A,kind:'Existing board-excluded formula'},special:{display:nsp.display,kind:'Existing board-excluded formula'},
    passive:{display:conversion.display,kind:'NEW empirical leader-conversion family, fitted after AH to two pairs; zero prospective successes. Uses measured AB1.8, not a computed baseline.'},
    board:{display:null,candidates:conditionalBoardCandidates,kind:'Conditional15.5/15.6 only if BOTH passive2.3 and combined17.8/17.9 families hold; no standalone board formula.'},
    conditionalJoint:{possibleDisplays:[17.8,17.9],raw:nb.joint.rawCombined,kind:'Existing conditional raw-sum plus separate ceil0.1 family; judgement contribution unresolved.'}},
   leaderConversion:conversion,
   diagnosticOnly:{boardReferenceWithoutSupport:nb.boardReference,cumulativeMarginalPassiveReference:nb.passiveMarginalReference,status:'Previously failed simple split, not adopted.'},
   interpretation:{passive2_3:'A first prospective match for the displayed-input conversion family; alternatives can also fit, so not a unique formula.',
    otherPassive:'Reject this common displayed-input multiplier family for the new pair, even if the combined sum still matches. Keep baseline and leader conversion separate.'},
   assumptions:'Same pre-song formation detail, existing member growth/board unlocks/order. Ririka has only Raden as RegLOSS member, so its costume condition is off. Ayame singer effects excluded; Raden life600 and regular Flare combo40 assumed met.',
   limitations:'AH->AI changes a member; the controlled leader comparison is AB->AI. Ririka support and judgement nodes change together across that pair. Do not infer a unique coefficient, causal node, or base passive formula from2.3. G0.1 mismatch and Ayame score-support outfit remain unresolved.',
   requestedMeasurements:'Member parameter, passive power, Active, SP, board and passive score separately; total score bonus if available.'},
  provenance:{AHCheckpointSHA256:checkpointHash,AHObservationSHA256:hash(obsPath('AH')),sourceHashes:sourceLock(),newEvidenceHashes:plan.newEvidenceHashes,
   previousObservationHashes:{...plan.observationHashes,[obsPath('W')]:hash(obsPath('W'))},
   previousSourceLocks:{...plan.previousSourceLocks,'analysis/unit-score/compare-passive-ag-20260909.mjs':plan.analysisSourceSHA256},predictionsAndProductionUnchanged:true}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareAHAndPlanAI(),null,2));
