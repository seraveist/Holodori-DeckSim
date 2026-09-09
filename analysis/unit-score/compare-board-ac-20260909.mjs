import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture} from './validation-data.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {boardPassiveFeatures} from './probe-passive-board-aa-20260909.mjs';
import {round1} from './dummy-model-lab.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(9));

export function boardDisplayCandidates(features,boardFeatures){
 assert.ok(features.conditions.passiveSupport.every(x=>x===0),'These display candidates are scoped to zero score-support passive.');
 assert.ok(Math.abs(features.Araw-boardFeatures.base)<1e-9);
 const raw=boardFeatures.raw.combined,post=boardFeatures.boardOnly,A=features.A;
 return {rawActive:features.Araw,displayedActive:A,rawBoardAdjustedActive:post,displayedBoardAdjustedActive:round1(post),rawIncrement:raw,
  rawIncrementCeil:round1(raw),rawIncrementRound:round1(raw,'round'),rawIncrementFloor:round1(raw,'floor'),
  differenceOfCeilDisplays:clean(round1(post)-A),ceilAfterSubtractingDisplayedActive:round1(post-A)};
}

export function compareACAndPlanAD(){
 const checkpoint='analysis/unit-score/experiments/baseline-board-AC-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 assert.equal(hash('analysis/unit-score/compare-passive-ab-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/probe-passive-board-aa-20260909.mjs'),plan.boardModelSourceSHA256);
 assert.equal(hash('analysis/unit-score/compare-passive-aa-20260909.mjs'),plan.AAComparisonSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-passive-AB-20260909.json'),plan.ABCheckpointSHA256);
 for(const [p,h] of Object.entries({...plan.newEvidenceHashes,...plan.observationHashes}))assert.equal(hash(p),h);
 const observations=[...fixture.observations,...['M','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC'].map(id=>read(`analysis/unit-score/observations/${id}-20260909${id==='Z'?'-completed':''}.json`))];
 const rows=observations.map(o=>{const f=displayedActiveFeatures(o);return {...f,quantized:quantizedSupportSP(f)};});
 assert.equal(rows.length,27);assert.equal(new Set(rows.map(r=>r.id)).size,27);
 assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 const distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;assert.equal(distinctMemberSets,18);
 const ac=observations.find(o=>o.sampleId==='AC'),acf=rows.find(r=>r.id==='AC');
 assert.equal(ac.predictionCheckpointSHA256,checkpointHash);assert.deepEqual(ac.memberIds,plan.memberIds);assert.equal(ac.leaderId,plan.leaderId);assert.deepEqual(ac.profiles,plan.profiles);
 assert.equal(ac.game.scoreBonusDetail.passive,null);assert.equal(ac.scoreRowPresence.passive,false);
 assert.equal(ac.game.overallPower,null);assert.equal(ac.game.scoreBonusPct,null);assert.equal(ac.game.powerDetail.outfit,null);
 // Only the analysis adapter treats the explicitly absent row as a zero displayed contribution.
 const normalizedAC=structuredClone(ac);normalizedAC.game.scoreBonusDetail.passive=0;
 const board=boardPassiveFeatures(normalizedAC),display=boardDisplayCandidates(acf,board);
 assert.ok(board.raw.passiveAfterBoard===0);assert.equal(display.rawIncrementCeil,1.6);assert.equal(ac.game.scoreBonusDetail.board,1.5);
 const comparisons=[
  {item:'memberParameter',kind:'calculated',predicted:plan.features.power.memberParameter,observed:ac.game.powerDetail.memberParameter},
  {item:'passivePower',kind:'calculated',predicted:plan.features.power.passive,observed:ac.game.powerDetail.passive},
  {item:'active',kind:'board-excluded research formula',predicted:plan.features.A,observed:ac.game.scoreBonusDetail.active},
  {item:'special',kind:'board-excluded research formula',predicted:plan.quantized.display,observed:ac.game.scoreBonusDetail.special},
  {item:'boardScore',kind:'frozen raw-increment ceil candidate',predicted:plan.hypotheses.board.display,observed:ac.game.scoreBonusDetail.board}
 ].map(c=>({...c,matches:c.predicted===c.observed,delta:clean(c.observed-c.predicted)}));
 assert.ok(comparisons.slice(0,4).every(c=>c.matches));assert.equal(comparisons[4].matches,false);assert.equal(comparisons[4].delta,-.1);
 const sum=clean(Object.values(ac.game.scoreBonusDetail).filter(v=>v!==null).reduce((s,v)=>s+v,0));assert.equal(sum,110.6);
 const memberPlusPassive=ac.game.powerDetail.memberParameter+ac.game.powerDetail.passive;assert.equal(memberPlusPassive,104021);
 const variants=[];
 for(const probabilityBoost of ['relative','absolute'])for(const cooldownMode of ['multiply','divide'])for(const cooldownRounding of ['raw','floor','round','ceil']){
  const config={probabilityBoost,cooldownMode,cooldownRounding},b=boardPassiveFeatures(normalizedAC,config),d=boardDisplayCandidates(acf,b);
  for(const displayRule of ['rawIncrementCeil','rawIncrementRound','rawIncrementFloor','differenceOfCeilDisplays'])variants.push({config,displayRule,predicted:d[displayRule],matches:d[displayRule]===ac.game.scoreBonusDetail.board});
 }
 assert.equal(variants.length,64);const matches=variants.filter(v=>v.matches);assert.equal(matches.length,3);
 assert.deepEqual(matches.map(v=>v.displayRule),['rawIncrementRound','rawIncrementFloor','differenceOfCeilDisplays']);
 assert.ok(matches.every(v=>v.config.probabilityBoost==='relative'&&v.config.cooldownMode==='divide'&&v.config.cooldownRounding==='raw'));
 const nextIds=ac.memberIds.map(id=>id==='card-06002-5-uniq-0058-00'?'card-06002-5-uniq-0066-00':id);
 const nextObservation={sampleId:'AD',leaderId:ac.leaderId,memberIds:nextIds,
  profiles:[ac.leaderId,...nextIds].map(id=>({... (ac.profiles.find(p=>p.id===id)??fixture.profiles.find(p=>p.id===id))}))};
 const nf=displayedActiveFeatures(nextObservation),nsp=quantizedSupportSP(nf),nb=boardPassiveFeatures(nextObservation),nd=boardDisplayCandidates(nf,nb);
 assert.equal(nf.power.memberParameter,76437);assert.equal(nf.power.passive,12553);assert.equal(nf.power.outfit,0);assert.equal(nf.retainedPower,88990);
 assert.equal(nf.A,71.3);assert.equal(nsp.display,41.6);assert.ok(nf.conditions.passiveSupport.every(x=>x===0));
 assert.equal(nd.differenceOfCeilDisplays,5.3);assert.equal(nd.rawIncrementFloor,5.3);assert.equal(nd.rawIncrementRound,5.4);assert.equal(nd.rawIncrementCeil,5.4);
 const timingInputs=b=>b.inputs.map(i=>({characterId:i.characterId,...i.board})).sort((a,b)=>a.characterId.localeCompare(b.characterId));
 assert.deepEqual(timingInputs(board),timingInputs(nb));
 assert.ok(!rows.some(r=>[...r.memberIds].sort().join(',')===[...nextIds].sort().join(',')));
 assert.equal(hash(checkpoint),checkpointHash);assert.deepEqual(sourceLock(),plan.sourceHashes);
 return {schemaVersion:1,recordedAt:new Date().toISOString(),scope:'AC failed board prediction with absent passive row, post-AC display-rule alternatives, and same-character Kanade-card AD control. No production changes.',
  observation:ac,comparisons,passiveComparison:{predicted:0,observedNumeric:null,observedRowPresent:false,normalizedDisplayedContribution:0,matches:true,normalization:'Confirmed absence only; raw observation remains null.'},
  arithmetic:{reportedOverallPower:null,memberPlusPassive,overallPowerRemainder:null,reportedScoreBonus:null,sumOfConfirmedBonusRows:sum,
   totalStatus:'110.6 is a derived sum, not an explicit total measurement. The preceding chat prediction table omitted total power and total score bonus.',
   oldConditionalTotalPrediction:plan.hypotheses.totalScoreBonus.display,oldConditionalTotalPredMinusDerived:clean(plan.hypotheses.totalScoreBonus.display-sum)},
  boardFeatures:board,displayCandidates:display,displayRuleGrid:{trials:64,variants,matches,
   interpretation:'Among these tested timing/probability configurations and display rules, only the original relative-probability/frequency-divisor/unrounded-interval raw model has matches, under three different final display rules. This is not identification of the general game formula.'},
  conclusion:{frozenPrediction:'AC board1.6 fails against1.5; passive absence matches. Keep this failure and the earlier AB7.4-vs7.5 failure intact.',
   arithmetic:'Raw increment1.5383027 gives1.6 under ceil,1.5 under round or floor. Separately ceiled Active values give69.9-68.4=1.5. AC does not discriminate the three surviving alternatives.',
   roundingLimit:'With zero score-support passive in the candidate and an absent passive UI row, the old raw-increment ceiling still fails. Splitting two positive board/passive category contributions and ceiling them separately is not a sufficient repair under that same candidate.',
   unchangedPositivePassiveProblem:'These display alternatives are scoped to zero score-support passive. They do not resolve individual board/passive allocations in Z/AA/AB.',
   measuredEvidence:'Card power components and board-excluded Active/SP remain consistent. The total power and total score bonus have not been supplied for AC.'},
  summary:{observations:27,distinctMemberSets,activeMatches:27,refinedSPMatches:27,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberChecks:['W','AA','AB','AC'],sameMemberLeaderChecks:['X','Y','Z']},
   frozenBoardFamilyEvidence:{postAADiscoveryRetrospectiveJointMatches:['Z','AA'],independentTrials:2,independentFailures:['AB joint display','AC board display'],independentSuccesses:0},
   newDisplayRules:{selectedAfter:'AC',retrospectiveSamples:1,independentSuccesses:0}},
  rows,
  next:{...nextObservation,features:nf,quantized:nsp,boardFeatures:nb,displayCandidates:nd,
   change:'Keep AC leader and four other members. Replace regular Kanade80/0 with swimsuit Kanade40/0.',
   purpose:'Hold member character-board inputs fixed and retain zero score-support passive, while the changed Active profile distinguishes raw-increment rounding from the floor/difference-of-ceil-displays alternatives.',
   fixedBoardInputs:timingInputs(nb),fixed:'Suisei leader, no active outfit or relevant leader boards, same five member characters and recorded timing/rate boards, no score-support passive.',
   hypotheses:{active:{display:nf.A,kind:'Existing board-excluded formula'},special:{display:nsp.display,kind:'Existing board-excluded formula'},
    passive:{display:0,kind:'Zero or absent passive score row expected from card effects.'},
    board:{singlePrediction:null,candidates:[{display:5.3,rules:['rawIncrementFloor','differenceOfCeilDisplays']},{display:5.4,rules:['rawIncrementRound']}],
     failedOldRule:{rule:'rawIncrementCeil',display:5.4,status:'Already failed AC; preserved as reference, not an AC-surviving candidate.'}},
    conditionalTotalScoreBonus:{byBoardDisplay:{'5.3':118.2,'5.4':118.3},status:'Derived sums assuming only Active/board/SP categories. No unique total prediction.'}},
   assumptions:'Same pre-song view and unchanged board unlocks. Swimsuit Kanade40/0 replaces regular Kanade80/0; other profiles stay fixed, including general Flare11/0. Raden life600 and Flare40combo treated as met; Ayame singer effects excluded.',
   limitations:'Changing the card also changes parameter-passive effects, member stats and SP, evaluated separately. AD5.3 cannot distinguish floor from difference of ceiled Active values. No final display rule is proven by one match.',
   interpretation:{'5.3':'Supports floor/difference-of-ceil alternatives over raw-increment round for this new composition; those two remain indistinguishable.',
    '5.4':'Supports raw-increment round over the two5.3 alternatives, conditional on the raw model. Does not undo the original AC raw-ceil failure.',
    other:'Record the miss and revisit the raw calculation/context rather than add a case-specific correction.'},
   requestedMeasurements:'Member parameter, passive power, Active, SP, exact board display and whether passive score is absent. Total score bonus if available.'},
  provenance:{ACCheckpointSHA256:checkpointHash,ACObservationSHA256:hash('analysis/unit-score/observations/AC-20260909.json'),sourceHashes:sourceLock(),
   newEvidenceHashes:plan.newEvidenceHashes,previousObservationHashes:plan.observationHashes,previousAnalysisSourceSHA256:plan.analysisSourceSHA256,
   boardModelSourceSHA256:plan.boardModelSourceSHA256,AAComparisonSourceSHA256:plan.AAComparisonSourceSHA256,predictionsAndProductionUnchanged:true}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareACAndPlanAD(),null,2));
