import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture} from './validation-data.mjs';
import {prepareScoreCards} from '../../js/card-prepare.js';
import {prepareDeckComposition} from '../../js/score.js';
import {integrate,round1,boards} from './dummy-model-lab.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {compareAEAndPlanAF,numericBoardResearch} from './compare-board-ae-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(9));
const cards=read('data/generated/cards.json'),characters=new Map(read('data/generated/characters.json').map(c=>[c.id,c])),masterRefs=read('data/generated/master_refs.json');
const prepare=o=>prepareScoreCards(cards,characters,Object.fromEntries(o.profiles.map(p=>[p.id,p])),{masterRefs,levelMode:'current'});

export function simplePassiveDiagnostics(o){
 const prepared=prepare(o),members=o.memberIds.map(id=>prepared.get(id)),c=prepareDeckComposition({leader:prepared.get(o.leaderId),members});
 assert.equal(c.leaderEffects.support,0);assert.equal(o.leaderId,'card-00018-5-uniq-0068-00');
 const evidence=read('analysis/unit-score/board-observations/AA-member-clarification-20260909.json'),boardMap=new Map(boards);
 boardMap.set(evidence.ayame.characterId,{rate:evidence.ayame.unconditionalActivationRateUpPct,cooldown:evidence.ayame.unconditionalCooldownShortenPct});
 const team={members,support:members.map(m=>c.passive.supportByMember[m.id])};
 const adjusted={...team,members:members.map(m=>{const b=boardMap.get(m.characterId);assert.ok(b);return {...m,active:{...m.active,
  probability:Math.min(1,m.active.probability*(1+b.rate/100)),interval:m.active.interval/(1+b.cooldown/100)}};})};
 const variants=[];
 for(const board of [false,true])for(const aggregation of ['weighted','maximum']){
  const t=board?adjusted:team,base=integrate(t,{aggregation}),boosted=integrate(t,{aggregation,passive:true}),raw=boosted-base;
  variants.push({board,aggregation,base,boosted,raw,ceil:round1(raw),differenceOfCeilDisplays:clean(round1(boosted)-round1(base))});
 }
 return {id:o.sampleId,observed:o.game.scoreBonusDetail.passive,variants};
}

export function compareAFAndPlanAG(){
 const checkpoint='analysis/unit-score/experiments/baseline-passive-AF-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 for(const [p,h] of Object.entries({...plan.newEvidenceHashes,...plan.observationHashes,...plan.previousSourceLocks}))assert.equal(hash(p),h);
 assert.equal(hash('analysis/unit-score/compare-board-ae-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-board-AE-20260909.json'),plan.AECheckpointSHA256);
 const previous=compareAEAndPlanAF(),af=read('analysis/unit-score/observations/AF-20260909.json');
 assert.equal(af.predictionCheckpointSHA256,checkpointHash);assert.equal(af.leaderId,plan.leaderId);assert.deepEqual(af.memberIds,plan.memberIds);assert.deepEqual(af.profiles,plan.profiles);
 assert.equal(af.game.overallPower,null);assert.equal(af.game.scoreBonusPct,null);
 const f=displayedActiveFeatures(af),sp=quantizedSupportSP(f),b=numericBoardResearch(af);
 const comparisons=[
  {item:'memberParameter',predicted:plan.features.power.memberParameter,observed:af.game.powerDetail.memberParameter},
  {item:'passivePower',predicted:plan.features.power.passive,observed:af.game.powerDetail.passive},
  {item:'active',predicted:plan.features.A,observed:af.game.scoreBonusDetail.active},
  {item:'special',predicted:plan.quantized.display,observed:af.game.scoreBonusDetail.special}
 ].map(c=>({...c,matches:c.predicted===c.observed}));assert.ok(comparisons.every(c=>c.matches));
 const rows=[...previous.rows,{...f,quantized:sp}],distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;
 assert.equal(rows.length,30);assert.equal(new Set(rows.map(r=>r.id)).size,30);assert.equal(distinctMemberSets,20);
 assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 assert.equal(plan.hypotheses.board.display,null);assert.equal(plan.hypotheses.passive.display,null);
 assert.equal(b.joint.reportedSum,3.3);assert.ok(plan.hypotheses.conditionalJoint.possibleDisplays.includes(b.joint.reportedSum));
 assert.equal(b.boardReference,.6);assert.equal(b.passiveMarginalReference,2.6);assert.equal(b.boardMatches,false);
 const jointComparison={frozenPossibleDisplays:plan.hypotheses.conditionalJoint.possibleDisplays,observedSum:b.joint.reportedSum,compatible:true,
  status:'First prospective check of the post-AB separate-ceil compatibility family; not an individual forecast success or an exact sum formula.'};
 const positiveRows=[...previous.extensionAudit.positivePassive.rows,b];assert.equal(positiveRows.length,15);assert.ok(positiveRows.every(r=>r.joint.compatible&&!r.boardMatches));
 const diagnosticRows=['Z','AA','AB'].map(id=>read(`analysis/unit-score/observations/${id}-20260909${id==='Z'?'-completed':''}.json`)).concat(af).map(simplePassiveDiagnostics);
 assert.ok(diagnosticRows.every(r=>r.variants.every(v=>v.ceil!==r.observed&&v.differenceOfCeilDisplays!==r.observed)));
 const scaleIntervals=diagnosticRows.map(r=>{const v=r.variants.find(v=>v.board&&v.aggregation==='weighted');return {id:r.id,
  lowerExclusive:(r.observed-.1)/v.raw,upperInclusive:r.observed/v.raw};});
 const scaleIntersection={lowerExclusive:Math.max(...scaleIntervals.map(i=>i.lowerExclusive)),upperInclusive:Math.min(...scaleIntervals.map(i=>i.upperInclusive))};
 assert.ok(scaleIntersection.lowerExclusive>scaleIntersection.upperInclusive);
 const ac=read('analysis/unit-score/observations/AC-20260909.json'),acb=numericBoardResearch(ac);
 const timingInputs=x=>x.inputs.map(i=>({characterId:i.characterId,...i.board})).sort((a,b)=>a.characterId.localeCompare(b.characterId));
 assert.deepEqual(timingInputs(b),timingInputs(acb));
 const acComparison={reference:'AC',sameLeader:true,sameMemberCharacters:true,sameRecordedTimingBoards:true,
  changedCard:'Regular Flare11/0 -> swimsuit Flare80/1',observed:{active:{AC:68.4,AF:71.8},special:{AC:40.7,AF:42.6},
  board:{AC:1.5,AF:2.3},passive:{AC:null,ACRowPresent:false,AF:1.0}},
  interpretation:'Member-board unlock inputs stay fixed, but the Flare card also changes Active/SP and stat passives. Board+0.8 is not an isolated causal effect of adding score-support passive.'};
 const nextIds=ac.memberIds.map(id=>id==='card-06002-5-uniq-0058-00'?'card-00022-5-uniq-0063-00':id);
 const nextObservation={sampleId:'AG',leaderId:ac.leaderId,memberIds:nextIds,
  profiles:[ac.leaderId,...nextIds].map(id=>({... (ac.profiles.find(p=>p.id===id)??fixture.profiles.find(p=>p.id===id))}))};
 const nf=displayedActiveFeatures(nextObservation),nsp=quantizedSupportSP(nf),nb=numericBoardResearch(nextObservation),np=prepare(nextObservation);
 assert.equal(nf.power.memberParameter,86545);assert.equal(nf.power.passive,10772);assert.equal(nf.power.outfit,0);assert.equal(nf.retainedPower,97317);
 assert.equal(nf.A,74.6);assert.equal(nsp.display,44.3);assert.deepEqual(nf.conditions.passiveSupport,[0,0,0,9,9]);
 assert.equal(nf.conditions.leaderScoreSupport,0);assert.equal(nf.conditions.leaderParameterConditionMet,false);
 assert.equal(nf.rateSum,f.rateSum);assert.equal(nf.W,f.W);
 const noel=np.get('card-00022-5-uniq-0063-00'),nm=nextIds.map(id=>np.get(id));
 assert.equal(noel.passive.effect.value,9);assert.equal(noel.passive.effect.target.kind,'group');
 assert.equal(nm.filter(m=>m.groupings.has(noel.passive.effect.target.value)).length,2);
 assert.deepEqual(nm.filter(m=>m.passive.effect.kind==='support').map(m=>m.id),[noel.id]);
 assert.equal(nf.SP.find(m=>m.id===noel.id).rate,40);
 assert.deepEqual(nb.joint.twoCeilPossibleSums,[7,7.1]);
 assert.ok(!rows.some(r=>[...r.memberIds].sort().join(',')===[...nextIds].sort().join(',')));
 assert.deepEqual(sourceLock(),plan.sourceHashes);assert.equal(hash(checkpoint),checkpointHash);
 return {schemaVersion:1,recordedAt:new Date().toISOString(),scope:'AF confirmed components, combined compatibility check, unresolved passive allocation, and a new Noel-only support9 AG forecast. Research only.',
  observation:af,comparisons,features:f,quantized:sp,numericBoardFeatures:b,jointComparison,
  individualComparison:{adoptedForecasts:{board:null,passive:null},observed:{board:2.3,passive:1},
   failedDiagnostic:{board:.6,passive:2.6},conclusion:'Individual formula remains unresolved. Do not reclassify the diagnostic split as an adopted pre-measurement forecast.'},
  arithmetic:{reportedOverallPower:null,reportedScoreBonus:null,memberPlusPassive:119214,sumOfConfirmedBonusRows:117.7,
   status:'Both sums are derived; totals remain unreported.'},acComparison,
  diagnostics:{rows:diagnosticRows,scaleIntervals,scaleIntersection,sharedPositiveScalePossible:false,
   conclusion:'Four named marginal aggregations with two display rules miss Z/AA/AB/AF; a shared positive scale on the board-adjusted weighted passive margin also cannot fit these four under ceil0.1. This is a bounded rejection, not an exhaustive formula search.'},
  extensionAudit:{zeroPassive:previous.extensionAudit.zeroPassive,positivePassive:{rows:positiveRows,total:15,individualBoardMatches:0,jointCompatible:15,
   evidence:{retrospectiveAtAFPlanning:14,prospectiveCompatibilityChecks:['AF']},
   conclusion:'Compatibility of a joint sum is not a computation of either displayed category.'}},
  summary:{observations:30,distinctMemberSets,activeMatches:30,refinedSPMatches:30,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberChecks:['W','AA','AB','AC','AD','AF'],sameMemberLeaderChecks:['X','Y','Z','AE']},
   passiveStatus:'Individual passive/board allocation and Ayame score-support outfit remain unresolved.'},rows,
  next:{...nextObservation,features:nf,quantized:nsp,numericBoardFeatures:nb,
   changeFromCurrentAF:'Replace swimsuit Flare80/1 with regular Flare11/0, and regular Kanade80/0 with swimsuit Noel80/1. Keep Suisei leader, Ayame, Towa and Raden.',
   controlReference:'AC',changeFromAC:'Replace regular Kanade80/0 with swimsuit Noel80/1.',
   purpose:'Test a different single score-support passive source: Noel support9 targets exactly Noel and regular Flare, the only two generation3 members. No Watame or swimsuit Flare support8 is present.',
   passiveSource:{ownerId:noel.id,effect:noel.passive,targetMemberIds:nextIds.filter((_,i)=>nf.conditions.passiveSupport[i]>0)},
   hypotheses:{active:{display:nf.A,kind:'Existing board-excluded formula'},special:{display:nsp.display,kind:'Existing board-excluded formula'},
    board:{display:null,kind:'Individual allocation unresolved'},passive:{display:null,kind:'Individual allocation unresolved'},
    conditionalJoint:{possibleDisplays:[7,7.1],raw:nb.joint.rawCombined,kind:'Conditional raw-sum plus separate ceil0.1 compatibility family only; no exact or individual forecast.'}},
   diagnosticOnly:{boardReferenceWithoutSupport:nb.boardReference,cumulativeMarginalPassiveReference:nb.passiveMarginalReference,
    status:'Already-failed simple split; not adopted predictions.'},
   assumptions:'Same pre-song formation detail; Suisei relevant leader boards absent and outfit condition off. Ayame singer nodes excluded. Raden life600 and regular Flare combo40 assumed met. Regular Flare11/0 confirmed in P; other growth/board unlocks unchanged.',
   limitations:'This changes card Active/SP/stat passives and member board context as well as the score-support source. It tests generalization across a new source/condition, not an isolated coefficient from8 to9. The two eligible recipients remove support-target selection ambiguity.',
   requestedMeasurements:'Member parameter, passive power, Active, SP, and board/passive score separately. Total score bonus if available.'},
  provenance:{AFCheckpointSHA256:checkpointHash,AFObservationSHA256:hash('analysis/unit-score/observations/AF-20260909.json'),sourceHashes:sourceLock(),
   newEvidenceHashes:plan.newEvidenceHashes,previousObservationHashes:plan.observationHashes,
   previousSourceLocks:{...plan.previousSourceLocks,'analysis/unit-score/compare-board-ae-20260909.mjs':plan.analysisSourceSHA256},predictionsAndProductionUnchanged:true}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareAFAndPlanAG(),null,2));
