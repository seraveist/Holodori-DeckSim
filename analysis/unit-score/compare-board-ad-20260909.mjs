import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture} from './validation-data.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {boardPassiveFeatures} from './probe-passive-board-aa-20260909.mjs';
import {boardDisplayCandidates,compareACAndPlanAD} from './compare-board-ac-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(9));

export function compareADAndPlanAE(){
 const checkpoint='analysis/unit-score/experiments/baseline-board-AD-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 const sourcePaths={analysisSourceSHA256:'analysis/unit-score/compare-board-ac-20260909.mjs',previousAnalysisSourceSHA256:'analysis/unit-score/compare-passive-ab-20260909.mjs',boardModelSourceSHA256:'analysis/unit-score/probe-passive-board-aa-20260909.mjs',AAComparisonSourceSHA256:'analysis/unit-score/compare-passive-aa-20260909.mjs'};
 for(const [key,p] of Object.entries(sourcePaths))assert.equal(hash(p),plan[key]);
 for(const [p,h] of Object.entries({...plan.newEvidenceHashes,...plan.observationHashes}))assert.equal(hash(p),h);
 assert.equal(hash('analysis/unit-score/experiments/baseline-board-AC-20260909.json'),plan.ACCheckpointSHA256);
 const previous=compareACAndPlanAD(),ad=read('analysis/unit-score/observations/AD-20260909.json');
 assert.equal(ad.predictionCheckpointSHA256,checkpointHash);assert.equal(ad.leaderId,plan.leaderId);
 assert.deepEqual(ad.memberIds,plan.memberIds);assert.deepEqual(ad.profiles,plan.profiles);
 const f=displayedActiveFeatures(ad),sp=quantizedSupportSP(f),rows=[...previous.rows,{...f,quantized:sp}];
 assert.equal(rows.length,28);assert.equal(new Set(rows.map(r=>r.id)).size,28);assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 const distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;assert.equal(distinctMemberSets,19);
 assert.equal(ad.scoreRowPresence.passive,false);assert.equal(ad.game.scoreBonusDetail.passive,null);
 assert.equal(ad.game.overallPower,null);assert.equal(ad.game.scoreBonusPct,null);assert.equal(ad.game.powerDetail.outfit,null);
 const normalized=structuredClone(ad);normalized.game.scoreBonusDetail.passive=0;
 const b=boardPassiveFeatures(normalized),d=boardDisplayCandidates(f,b);
 const comparisons=[
  {item:'memberParameter',kind:'calculated',predicted:plan.features.power.memberParameter,observed:ad.game.powerDetail.memberParameter},
  {item:'passivePower',kind:'calculated',predicted:plan.features.power.passive,observed:ad.game.powerDetail.passive},
  {item:'active',kind:'existing board-excluded research formula',predicted:plan.features.A,observed:ad.game.scoreBonusDetail.active},
  {item:'special',kind:'existing board-excluded research formula',predicted:plan.quantized.display,observed:ad.game.scoreBonusDetail.special},
  ...['rawIncrementFloor','differenceOfCeilDisplays','rawIncrementRound'].map(rule=>({item:'boardScore',kind:rule,predicted:plan.displayCandidates[rule],observed:ad.game.scoreBonusDetail.board}))
 ].map(c=>({...c,matches:c.predicted===c.observed,delta:clean(c.observed-c.predicted)}));
 assert.ok(comparisons.slice(0,6).every(c=>c.matches));assert.equal(comparisons[6].matches,false);assert.equal(comparisons[6].delta,-.1);
 assert.equal(d.rawIncrementFloor,5.3);assert.equal(d.differenceOfCeilDisplays,5.3);assert.equal(d.rawIncrementRound,5.4);
 const categorySum=clean(Object.values(ad.game.scoreBonusDetail).filter(v=>v!==null).reduce((s,v)=>s+v,0));assert.equal(categorySum,118.2);
 const memberPlusPassive=ad.game.powerDetail.memberParameter+ad.game.powerDetail.passive;assert.equal(memberPlusPassive,88990);
 const controls=[{id:'AC',observed:previous.observation.game.scoreBonusDetail.board,display:previous.displayCandidates},
  {id:'AD',observed:ad.game.scoreBonusDetail.board,display:d}];
 const survivorRules=['rawIncrementFloor','differenceOfCeilDisplays','rawIncrementRound'].filter(rule=>controls.every(c=>c.display[rule]===c.observed));
 assert.deepEqual(survivorRules,['rawIncrementFloor','differenceOfCeilDisplays']);
 const timingInputs=x=>x.inputs.map(i=>({characterId:i.characterId,...i.board})).sort((a,b)=>a.characterId.localeCompare(b.characterId));
 assert.deepEqual(timingInputs(b),plan.fixedBoardInputs);assert.deepEqual(timingInputs(b),timingInputs(previous.boardFeatures));
 const nextIds=ad.memberIds.map(id=>id==='card-00021-5-uniq-0017-00'?'card-00022-5-uniq-0063-00':id);
 const nextObservation={sampleId:'AE',leaderId:ad.leaderId,memberIds:nextIds,
  profiles:[ad.leaderId,...nextIds].map(id=>({... (ad.profiles.find(p=>p.id===id)??fixture.profiles.find(p=>p.id===id))}))};
 const nf=displayedActiveFeatures(nextObservation),nsp=quantizedSupportSP(nf),nb=boardPassiveFeatures(nextObservation),nd=boardDisplayCandidates(nf,nb);
 assert.ok(nf.conditions.passiveSupport.every(x=>x===0));assert.equal(nf.conditions.leaderScoreSupport,0);assert.equal(nf.conditions.leaderParameterConditionMet,false);
 assert.equal(nf.power.memberParameter,92663);assert.equal(nf.power.passive,11520);assert.equal(nf.power.outfit,0);assert.equal(nf.retainedPower,104183);
 assert.equal(nf.A,73.3);assert.equal(nsp.display,41.3);assert.equal(nd.rawIncrementFloor,4.8);assert.equal(nd.differenceOfCeilDisplays,4.9);
 const existingMemberSetReferences=rows.filter(r=>[...r.memberIds].sort().join(',')===[...nextIds].sort().join(',')).map(r=>r.id);
 assert.deepEqual(existingMemberSetReferences,['R']);
 const r=rows.find(r=>r.id==='R');assert.equal(r.A,nf.A);assert.equal(r.quantized.display,nsp.display);
 assert.equal(r.power.memberParameter,nf.power.memberParameter);assert.equal(r.power.passive,nf.power.passive);
 const beforeFlare=b.inputs.find(i=>i.characterId==='chr-00021'),afterNoel=nb.inputs.find(i=>i.characterId==='chr-00022');
 assert.deepEqual(beforeFlare.board,{rate:6,cooldown:0});assert.deepEqual(afterNoel.board,{rate:23.5,cooldown:4});
 const configChecks=[];
 for(const probabilityBoost of ['relative','absolute'])for(const cooldownMode of ['multiply','divide'])for(const cooldownRounding of ['raw','floor','round','ceil']){
  const config={probabilityBoost,cooldownMode,cooldownRounding},bf=boardPassiveFeatures(nextObservation,config),dc=boardDisplayCandidates(nf,bf);
  configChecks.push({config,rawIncrement:dc.rawIncrement,rawIncrementFloor:dc.rawIncrementFloor,differenceOfCeilDisplays:dc.differenceOfCeilDisplays});
 }
 assert.equal(hash(checkpoint),checkpointHash);assert.deepEqual(sourceLock(),plan.sourceHashes);
 return {schemaVersion:1,recordedAt:new Date().toISOString(),scope:'AD discriminates board raw-increment round from floor/display-difference candidates; freeze AE to distinguish the two survivors. Production formulas unchanged.',
  observation:ad,comparisons,
  passiveComparison:{predicted:0,observedNumeric:null,observedRowPresent:false,normalizedDisplayedContribution:0,matches:true,basis:'All match confirms the absent-row prediction in the immediately preceding chat table.'},
  arithmetic:{reportedOverallPower:null,memberPlusPassive,overallPowerRemainder:null,reportedScoreBonus:null,sumOfConfirmedBonusRows:categorySum,
   status:'88990 is a power subtotal and118.2 is a category sum; neither is a directly reported overall total.'},
  boardFeatures:b,displayCandidates:d,controls,survivorRules,
  conclusion:{result:'The two frozen5.3 predictions match AD; the raw-increment round5.4 prediction fails.',
   scope:'This rejects that rounding candidate conditional on the unchanged tested raw model. It does not prove a universal game rounding rule.',
   remaining:'Floor of the raw increment and difference of ceiled before/after Active values both match AC and AD. The latter equals ceiling after subtracting displayed base Active.',
   positivePassive:'Z/AA/AB individual board/passive allocation and Ayame score-support outfit remain unresolved. Do not extend these zero-support-passive display candidates into a solved general passive formula.'},
  summary:{observations:28,distinctMemberSets,activeMatches:28,refinedSPMatches:28,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberChecks:['W','AA','AB','AC','AD'],sameMemberLeaderChecks:['X','Y','Z']},
   displayCandidateEvidence:{selectedAfter:'AC',retrospectiveSamples:['AC'],independentSamples:['AD'],
    successfulIndependentRules:['rawIncrementFloor','differenceOfCeilDisplays'],failedIndependentRules:['rawIncrementRound'],
    originalRawCeil:'Still rejected by AC; its coincident AD5.4 prediction is not revived.'}},
  rows,
  next:{...nextObservation,features:nf,quantized:nsp,boardFeatures:nb,displayCandidates:nd,configChecks,
   change:'From AD keep Suisei leader and Ayame, Towa, Raden, swimsuit Kanade. Replace regular Flare11/0 with swimsuit Noel80/1.',
   purpose:'Distinguish the two AC/AD-surviving display rules while retaining zero score-support passive and the same inactive leader outfit.',
   fixed:'Suisei leader, no related leader boards, inactive outfit, no score-support passive. Noel third-generation condition is unmet because there is no other third-generation member.',
   changedBoardInputs:{before:{characterId:'chr-00021',...beforeFlare.board},after:{characterId:'chr-00022',...afterNoel.board},
    scope:'Known member-board inputs change and are evaluated explicitly; this is not a same-character board control like AC-to-AD.'},
   existingMemberSetReferences,existingSetInterpretation:'These five members were observed in R under Ririka leader. AE changes that leader context; it is a fresh board display test under Suisei, not a new unique member set or an independent new-set Active/SP test.',
   hypotheses:{active:{display:nf.A,kind:'Existing board-excluded formula; also reproduced by historical R'},special:{display:nsp.display,kind:'Existing board-excluded formula; also reproduced by historical R'},
    passive:{display:0,kind:'Zero or absent passive score expected; Noel support condition is unmet.'},
    board:{singlePrediction:null,candidates:[{display:4.8,rule:'rawIncrementFloor'},{display:4.9,rule:'differenceOfCeilDisplays'}],
     rejectedReferences:[{display:nd.rawIncrementCeil,rule:'rawIncrementCeil',failedAt:'AC'},{display:nd.rawIncrementRound,rule:'rawIncrementRound',failedAt:'AD'}]},
    conditionalTotalScoreBonus:{byBoardDisplay:{'4.8':119.4,'4.9':119.5},status:'Derived sums assuming only Active/board/SP categories.'}},
   assumptions:'Same pre-song view. Keep unchanged levels and board unlocks; swimsuit Noel80/1 uses rate23.5/frequency4 confirmed in the AA follow-up. Raden life600 assumed met, Ayame singer effects excluded.',
   limitations:'The replacement changes card Active, SP, power-passives and member boards; each is evaluated under its candidate. An AE match selects between these two rules for the current data, not every possible game formula.',
   interpretation:{'4.8':'Supports raw-increment floor over difference of ceiled Actives under the frozen raw model.',
    '4.9':'Supports difference of ceiled Actives over raw-increment floor under the frozen raw model. Earlier rejected round/ceil rules remain rejected.',
    other:'Preserve the failure and revisit raw calculation or context without a case-specific correction.'},
   requestedMeasurements:'Member parameter, passive power, Active, SP, exact board display and passive score row presence. Report total score bonus if available.'},
  provenance:{ADCheckpointSHA256:checkpointHash,ADObservationSHA256:hash('analysis/unit-score/observations/AD-20260909.json'),sourceHashes:sourceLock(),
   newEvidenceHashes:plan.newEvidenceHashes,previousObservationHashes:plan.observationHashes,sourceLocks:Object.fromEntries(Object.entries(sourcePaths).map(([key,p])=>[p,plan[key]])),predictionsAndProductionUnchanged:true}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareADAndPlanAE(),null,2));
