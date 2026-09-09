import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture} from './validation-data.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {numericBoardResearch} from './compare-board-ae-20260909.mjs';
import {compareAHAndPlanAI} from './compare-passive-ah-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(12)),eps=1e-10;
const obsPath=id=>`analysis/unit-score/observations/${id}-20260909${id==='Z'?'-completed':''}.json`;
const interval=(lower,upper,lowerClosed=false,upperClosed=false)=>({lower,upper,lowerClosed,upperClosed});
const intersect=(...xs)=>{
 const lower=Math.max(...xs.map(x=>x.lower)),upper=Math.min(...xs.map(x=>x.upper));
 return {lower,upper,lowerClosed:xs.filter(x=>Math.abs(x.lower-lower)<eps).every(x=>x.lowerClosed),upperClosed:xs.filter(x=>Math.abs(x.upper-upper)<eps).every(x=>x.upperClosed)};
};
const nonempty=x=>x.upper-x.lower>eps||(Math.abs(x.upper-x.lower)<=eps&&x.lowerClosed&&x.upperClosed);
const displayRange=x=>Array.from({length:201},(_,i)=>i/10).filter(y=>nonempty(intersect(x,interval(clean(y-.1),y,false,true))));
const rawPassive=(o,useCombined)=>{
 const p=o.game.scoreBonusDetail.passive,b=o.game.scoreBonusDetail.board,displayOnly=interval(clean(p-.1),p,false,true);
 if(!useCombined)return displayOnly;
 const total=numericBoardResearch(o).joint.rawCombined;
 // Conditional inference: p_raw+b_raw equals this modeled raw total, and each row is independently ceiled.
 const inferred=intersect(displayOnly,interval(total-b,total-b+.1,true,false));assert.ok(nonempty(inferred));return inferred;
};
const ratio=(x,y)=>interval(y.lower/x.upper,y.upper/x.lower,y.lowerClosed&&x.upperClosed,y.upperClosed&&x.lowerClosed);
const difference=(x,y)=>interval(y.lower-x.upper,y.upper-x.lower,y.lowerClosed&&x.upperClosed,y.upperClosed&&x.lowerClosed);

export function latentLeaderFamilies(pairs,baseline,useCombined=false){
 const rows=pairs.map(([base,leader])=>{const x=rawPassive(base,useCombined),y=rawPassive(leader,useCombined);return {
  baseId:base.sampleId,leaderId:leader.sampleId,baseRawInterval:x,leaderRawInterval:y,multiplier:ratio(x,y),addend:difference(x,y)};});
 const multiplier=intersect(...rows.map(r=>r.multiplier)),addend=intersect(...rows.map(r=>r.addend));assert.ok(nonempty(multiplier)&&nonempty(addend));
 const x=rawPassive(baseline,useCombined);
 const multiplied=interval(x.lower*multiplier.lower,x.upper*multiplier.upper,x.lowerClosed&&multiplier.lowerClosed,x.upperClosed&&multiplier.upperClosed);
 const added=interval(x.lower+addend.lower,x.upper+addend.upper,x.lowerClosed&&addend.lowerClosed,x.upperClosed&&addend.upperClosed);
 return {assumption:useCombined?'Latent passive intervals additionally assume the modeled board+passive raw sum is exact and both categories independently ceil0.1.':'Only passive ceil0.1 intervals and a shared raw leader conversion; no raw-sum constraint.',
  rows,multiplier,addend,baselineId:baseline.sampleId,baselinePassive:baseline.game.scoreBonusDetail.passive,baselineRawInterval:x,
  predictions:{rawMultiplier:{rawInterval:multiplied,possibleDisplays:displayRange(multiplied)},rawAddend:{rawInterval:added,possibleDisplays:displayRange(added)}}};
}

export function compareAIAndPlanAJ(){
 const checkpoint='analysis/unit-score/experiments/baseline-passive-AI-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 for(const [p,h] of Object.entries({...plan.newEvidenceHashes,...plan.observationHashes,...plan.previousSourceLocks}))assert.equal(hash(p),h);
 assert.equal(hash('analysis/unit-score/compare-passive-ah-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-passive-AH-20260909.json'),plan.AHCheckpointSHA256);
 const previous=compareAHAndPlanAI(),ai=read(obsPath('AI')),ab=read(obsPath('AB'));
 assert.equal(ai.predictionCheckpointSHA256,checkpointHash);assert.equal(ai.leaderId,plan.leaderId);assert.deepEqual(ai.memberIds,plan.memberIds);assert.deepEqual(ai.profiles,plan.profiles);
 assert.equal(ai.game.overallPower,null);assert.equal(ai.game.scoreBonusPct,null);
 const f=displayedActiveFeatures(ai),sp=quantizedSupportSP(f),b=numericBoardResearch(ai),abf=displayedActiveFeatures(ab);
 assert.deepEqual(f.conditions,abf.conditions);assert.deepEqual(f.memberIds,abf.memberIds);assert.deepEqual(f.power,abf.power);
 const comparisons=[
  {item:'memberParameter',predicted:plan.features.power.memberParameter,observed:ai.game.powerDetail.memberParameter},
  {item:'passivePower',predicted:plan.features.power.passive,observed:ai.game.powerDetail.passive},
  {item:'active',predicted:plan.features.A,observed:ai.game.scoreBonusDetail.active},
  {item:'special',predicted:plan.quantized.display,observed:ai.game.scoreBonusDetail.special},
  {item:'passiveScore',predicted:plan.hypotheses.passive.display,observed:ai.game.scoreBonusDetail.passive}
 ].map(c=>({...c,matches:c.predicted===c.observed,delta:clean(c.observed-c.predicted)}));
 assert.ok(comparisons.slice(0,4).every(c=>c.matches));assert.equal(comparisons[4].matches,false);assert.equal(comparisons[4].delta,-.1);
 const rows=[...previous.rows,{...f,quantized:sp}],distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;
 assert.equal(rows.length,33);assert.equal(new Set(rows.map(r=>r.id)).size,33);assert.equal(distinctMemberSets,21);
 assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 assert.equal(b.joint.reportedSum,17.9);assert.ok(plan.hypotheses.conditionalJoint.possibleDisplays.includes(b.joint.reportedSum));
 assert.ok(!plan.hypotheses.board.candidates.includes(ai.game.scoreBonusDetail.board));
 assert.equal(b.boardReference,14.8);assert.equal(b.passiveMarginalReference,3);assert.equal(b.boardMatches,false);
 const delta={board:clean(ai.game.scoreBonusDetail.board-ab.game.scoreBonusDetail.board),passive:clean(ai.game.scoreBonusDetail.passive-ab.game.scoreBonusDetail.passive),
  joint:clean(b.joint.reportedSum-numericBoardResearch(ab).joint.reportedSum),active:0,special:0};assert.deepEqual(delta,{board:10,passive:.4,joint:10.4,active:0,special:0});
 const positiveRows=[...previous.extensionAudit.positivePassive.rows,b];assert.equal(positiveRows.length,18);assert.ok(positiveRows.every(r=>r.joint.compatible&&!r.boardMatches));
 const pairIds=[['Z','W'],['AG','AH'],['AB','AI']],pairs=pairIds.map(ids=>ids.map(id=>read(obsPath(id))));
 const displayedK=pairs.map(([base,leader])=>interval((Math.round(leader.game.scoreBonusDetail.passive*10)-1)/Math.round(base.game.scoreBonusDetail.passive*10),leader.game.scoreBonusDetail.passive/base.game.scoreBonusDetail.passive,false,true));
 const displayedIntersection=intersect(...displayedK);assert.ok(!nonempty(displayedIntersection));
 const rejection={family:plan.leaderConversion.formula,frozenPrediction:2.3,observed:2.2,
  status:'Rejected at its first prospective check. Do not refit or round away the failure.',perPairIntervals:displayedK,threePairIntersection:displayedIntersection,
  explanation:'The first two pairs require k>1.235294..., while AB/AI requires k<=1.222222...; no common displayed-input coefficient can fit all three.'};
 const aiLatentCompatibility={frozenRawMultiplier:plan.leaderConversion.latentAlternatives.commonRawMultiplier.possibleAI,
  frozenRawAddend:plan.leaderConversion.latentAlternatives.commonRawAddend.possibleAI,observed:2.2};
 assert.ok(aiLatentCompatibility.frozenRawMultiplier.includes(2.2)&&aiLatentCompatibility.frozenRawAddend.includes(2.2));
 const aa=read(obsPath('AA')),plain=latentLeaderFamilies(pairs,aa),combined=latentLeaderFamilies(pairs,aa,true);
 for(const family of [plain,combined]){assert.deepEqual(family.predictions.rawMultiplier.possibleDisplays,[.9,1,1.1]);assert.deepEqual(family.predictions.rawAddend.possibleDisplays,[1.2,1.3]);}
 const leaderId=ai.leaderId,nextObservation={sampleId:'AJ',leaderId,memberIds:[...aa.memberIds],profiles:[leaderId,...aa.memberIds].map(id=>({... (aa.profiles.find(p=>p.id===id)??fixture.profiles.find(p=>p.id===id))}))};
 const nf=displayedActiveFeatures(nextObservation),nsp=quantizedSupportSP(nf),nb=numericBoardResearch(nextObservation),aaf=displayedActiveFeatures(aa);
 assert.deepEqual(nf.memberIds,aaf.memberIds);assert.deepEqual(nf.conditions.passiveSupport,aaf.conditions.passiveSupport);assert.deepEqual(nf.SP,aaf.SP);
 assert.deepEqual(nb.inputs,numericBoardResearch(aa).inputs);
 assert.equal(nf.power.memberParameter,100252);assert.equal(nf.power.passive,22531);assert.equal(nf.power.outfit,50131);assert.equal(nf.retainedPower,172914);
 assert.equal(nf.A,71.1);assert.equal(nsp.display,42.2);assert.equal(nf.conditions.leaderScoreSupport,0);assert.equal(nf.conditions.leaderParameterConditionMet,true);
 assert.equal(aaf.conditions.leaderParameterConditionMet,false);assert.deepEqual(nb.joint.twoCeilPossibleSums,[13.7,13.8]);
 assert.deepEqual(nextObservation.memberIds,ai.memberIds.map(id=>id==='card-00021-5-uniq-0017-00'?'card-06002-5-uniq-0058-00':id));
 const costumeControls=['X','Y','Z'].map(id=>{const o=read(obsPath(id)),features=displayedActiveFeatures(o);return {id,outfitPower:features.power.outfit,leaderScoreSupport:features.conditions.leaderScoreSupport,
  passive:o.game.scoreBonusDetail.passive,board:o.game.scoreBonusDetail.board,active:o.game.scoreBonusDetail.active,special:o.game.scoreBonusDetail.special};});
 assert.ok(costumeControls.every(r=>r.passive===1.5&&r.board===6.9&&r.active===75.5&&r.special===43.2&&r.leaderScoreSupport===0));
 assert.deepEqual(sourceLock(),plan.sourceHashes);assert.equal(hash(checkpoint),checkpointHash);
 return {schemaVersion:1,recordedAt:new Date().toISOString(),scope:'AI rejects displayed-input passive conversion; preserve matched base/joint models and discriminate pre-existing latent raw alternatives with AJ. Research only.',
  observation:ai,comparisons,features:f,quantized:sp,numericBoardFeatures:b,
  jointComparison:{frozenPossibleDisplays:plan.hypotheses.conditionalJoint.possibleDisplays,observedSum:17.9,compatible:true,status:'Fourth prospective positive-passive conditional-sum check after AF/AG/AH.'},
  conditionalBoardComparison:{frozenCandidates:plan.hypotheses.board.candidates,observed:15.7,matches:false,
   interpretation:'These candidates depended on passive2.3. The observed17.9 sum and2.2 passive reconcile15.7 arithmetically, but that does not turn the old candidates into a prediction success.'},
  displayedConversionRejection:rejection,aiLatentCompatibility,
  leaderPair:{base:'AB',leader:'AI',delta,bothCostumesOff:true,sameMemberConditions:true},
  latentFamilies:{roundingOnly:plain,conditionalOnModeledRawSum:combined,
   interpretation:'Both raw alternatives allowed AI2.2 before measurement. Three-pair constraints now narrow them; the modeled raw sum can narrow latent values further without changing the AJ display ranges.',
   limitation:'These are conversions of hidden raw passive values inferred from measured displays, not independent calculations of base passive from card skills.'},
  arithmetic:{reportedOverallPower:null,reportedScoreBonus:null,memberPlusPassive:97643,sumOfConfirmedBonusRows:135.2,status:'Derived subtotals only; overall totals unreported.'},
  extensionAudit:{zeroPassive:previous.extensionAudit.zeroPassive,positivePassive:{rows:positiveRows,total:18,individualBoardMatches:0,jointCompatible:18,
   evidence:{retrospectiveAtAFPlanning:14,prospectiveCompatibilityChecks:['AF','AG','AH','AI']}}},
  summary:{observations:33,distinctMemberSets,activeMatches:33,refinedSPMatches:33,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberChecks:['W','AA','AB','AC','AD','AF','AG'],sameMemberLeaderChecks:['X','Y','Z','AE','AH','AI']},
   passiveStatus:'Displayed-input multiplier rejected. Latent raw multiplier/addend alternatives survive conditionally; baseline passive and Ayame outfit unresolved.'},rows,
  next:{...nextObservation,features:nf,quantized:nsp,numericBoardFeatures:nb,
   changeFromCurrentAI:'Replace regular Flare11/0 with regular Kanade80/0. Keep Ririka40/0 leader, Ayame40/0, Towa70/0, Raden70/1 and Watame70/1.',
   controlReference:'AA',changeFromAA:'Same five members/profiles/member boards/order, but leader changes from Suisei60/0 to Ririka40/0. Ririka parameter costume also becomes active.',
   purpose:'AA measured passive0.8 yields disjoint predictions for the surviving raw multiplier and raw additive leader-conversion families.',
   hypotheses:{active:{display:nf.A,kind:'Existing board-excluded formula'},special:{display:nsp.display,kind:'Existing board-excluded formula'},
    passive:{display:null,candidates:[{rule:'commonRawMultiplier',possibleDisplays:[.9,1,1.1]},{rule:'commonRawAddend',possibleDisplays:[1.2,1.3]}],
     kind:'Disjoint prospective ranges, conditional on latent ceil0.1 conversion and no score interaction from the parameter-only costume.'},
    board:{display:null,kind:'No standalone category formula; measure separately.'},conditionalJoint:{possibleDisplays:[13.7,13.8],raw:nb.joint.rawCombined,kind:'Existing conditional raw-sum/separate-ceil family.'}},
   latentFamilies:{roundingOnly:plain,conditionalOnModeledRawSum:combined},
   parameterCostume:{enabled:true,predictedPower:50131,scoreSupport:0,
    reason:'Raden and regular Kanade are two RegLOSS members, enabling Ririka all-parameter50 costume.',
    priorControls:costumeControls,
    workingAssumption:'X/Y/Z showed unchanged score rows with parameter-only costumes on/off in a different member set. Carry forward as a test assumption, not universal proof.',
    limitation:'AA/AJ is not an inactive-costume-only leader pair. If neither passive family fits, check this assumption before attributing the failure only to the latent conversions.'},
   interpretation:{passive0_9to1_1:'Supports the raw multiplier family over the raw addend family conditional on the costume/context assumptions; does not prove a unique formula.',
    passive1_2to1_3:'Supports the raw addend family over the raw multiplier family under the same assumptions.',
    outsideBoth:'Neither predicted range fits. Record the failure and revisit conversion/costume assumptions without changing frozen predictions.'},
   assumptions:'Same pre-song formation detail; original member growth/board unlocks/order. Ayame singer nodes excluded. Raden life600 and regular Kanade combo100 assumed met. Watame Happy2 condition met.',
   limitations:'Both Ririka support13.3 and unquantified judgement nodes change relative to AA. Parameter costume enables as noted. G0.1 residual and Ayame score-support outfit remain unresolved. AJ would reuse AA member set, not a new distinct member set.',
   requestedMeasurements:'Member parameter, outfit power, passive power, Active, SP, and passive/board score separately. Total score bonus if available.'},
  provenance:{AICheckpointSHA256:checkpointHash,AIObservationSHA256:hash(obsPath('AI')),sourceHashes:sourceLock(),newEvidenceHashes:plan.newEvidenceHashes,
   previousObservationHashes:{...plan.observationHashes,...Object.fromEntries(['X','Y'].map(id=>[obsPath(id),hash(obsPath(id))]))},
   previousSourceLocks:{...plan.previousSourceLocks,'analysis/unit-score/compare-passive-ah-20260909.mjs':plan.analysisSourceSHA256},predictionsAndProductionUnchanged:true}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareAIAndPlanAJ(),null,2));
