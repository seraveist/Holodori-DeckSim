import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture} from './validation-data.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {boardPassiveFeatures} from './probe-passive-board-aa-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(9));

export function compareABAndPlanAC(){
 const checkpoint='analysis/unit-score/experiments/baseline-passive-AB-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 assert.equal(hash('analysis/unit-score/probe-passive-board-aa-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/compare-passive-aa-20260909.mjs'),plan.comparisonSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-passive-AA-20260909.json'),plan.AACheckpointSHA256);
 for(const [p,h] of Object.entries({...plan.newEvidenceHashes,...plan.observationHashes}))assert.equal(hash(p),h);
 const observations=[...fixture.observations,...['M','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB'].map(id=>read(`analysis/unit-score/observations/${id}-20260909${id==='Z'?'-completed':''}.json`))];
 const rows=observations.map(o=>{const f=displayedActiveFeatures(o);return {...f,quantized:quantizedSupportSP(f)};});
 assert.equal(rows.length,26);assert.equal(new Set(rows.map(r=>r.id)).size,26);
 assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 const distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;assert.equal(distinctMemberSets,17);
 const ab=observations.find(o=>o.sampleId==='AB'),aa=observations.find(o=>o.sampleId==='AA'),abf=rows.find(r=>r.id==='AB');
 assert.equal(ab.predictionCheckpointSHA256,checkpointHash);assert.equal(ab.leaderId,plan.leaderId);
 assert.deepEqual(ab.memberIds,plan.memberIds);assert.deepEqual(ab.profiles,plan.profiles);
 assert.equal(ab.game.powerDetail.outfit,null);assert.equal(abf.power.outfit,0);
 const sum=clean(ab.game.scoreBonusDetail.board+ab.game.scoreBonusDetail.passive);assert.equal(sum,7.5);
 const comparisons=[
  {item:'memberParameter',kind:'calculated',predicted:plan.features.power.memberParameter,observed:ab.game.powerDetail.memberParameter},
  {item:'passivePower',kind:'calculated',predicted:plan.features.power.passive,observed:ab.game.powerDetail.passive},
  {item:'active',kind:'research formula',predicted:plan.features.A,observed:ab.game.scoreBonusDetail.active},
  {item:'special',kind:'research formula',predicted:plan.quantized.display,observed:ab.game.scoreBonusDetail.special},
  {item:'boardPlusPassive',kind:'frozen joint single-ceil candidate',predicted:plan.hypotheses.boardPlusPassive.display,observed:sum},
  {item:'passiveScore',kind:'not predicted',predicted:null,observed:ab.game.scoreBonusDetail.passive},
  {item:'boardScore',kind:'not predicted',predicted:null,observed:ab.game.scoreBonusDetail.board}
 ].map(c=>({...c,matches:c.predicted===null?null:c.predicted===c.observed,delta:c.predicted===null?null:clean(c.observed-c.predicted)}));
 assert.ok(comparisons.slice(0,4).every(c=>c.matches));assert.equal(comparisons[4].matches,false);assert.equal(comparisons[4].delta,0.1);
 const suppliedBonusSum=clean(Object.values(ab.game.scoreBonusDetail).filter(v=>v!==null).reduce((s,v)=>s+v,0));
 assert.equal(suppliedBonusSum,124.8);assert.equal(suppliedBonusSum,ab.game.scoreBonusPct);
 const memberPlusPassive=ab.game.powerDetail.memberParameter+ab.game.powerDetail.passive,remainder=ab.game.overallPower-memberPlusPassive;
 assert.equal(memberPlusPassive,97643);assert.equal(memberPlusPassive,plan.features.retainedPower);assert.equal(remainder,20610);
 const controls=['Z','AA','AB'].map(id=>{
  const o=observations.find(o=>o.sampleId===id),f=rows.find(r=>r.id===id),b=boardPassiveFeatures(o);
  assert.equal(o.leaderId,ab.leaderId);assert.equal(f.conditions.leaderParameterConditionMet,false);assert.equal(f.conditions.leaderScoreSupport,0);
  assert.deepEqual(f.conditions.passiveSupport,[0,0,8,0,8]);
  assert.deepEqual(b.inputs.filter(i=>i.support>0).map(i=>i.id),['card-06004-5-uniq-0060-00','card-00026-5-uniq-0065-00']);
  const d=b.observed.sum,t=b.raw.combined;
  const intervals={ceil:{lower:clean(d-.2),upper:d,lowerInclusive:false,upperInclusive:true},
   round:{lower:clean(d-.1),upper:clean(d+.1),lowerInclusive:true,upperInclusive:false},
   floor:{lower:d,upper:clean(d+.2),lowerInclusive:true,upperInclusive:false}};
  for(const [mode,r] of Object.entries(intervals))r.compatible=mode==='ceil'?t>r.lower&&t<=r.upper:t>=r.lower&&t<r.upper;
  const passiveLower=Math.max(b.observed.passive-.1,t-b.observed.board),passiveUpper=Math.min(b.observed.passive,t-(b.observed.board-.1));
  return {id,active:f.A,special:f.quantized.display,...b,
   separatelyRoundedSumIntervals:intervals,
   conditionalPassiveRawBounds:{lower:passiveLower,upper:passiveUpper,
    lowerInclusive:t-b.observed.board>b.observed.passive-.1,upperInclusive:b.observed.passive<t-(b.observed.board-.1),
    status:'Feasibility bounds conditional on this unproven joint raw value and independent ceil0.1 category rounding; not measured or calculated individual passive contributions.'}};
 });
 assert.ok(controls.every(c=>c.separatelyRoundedSumIntervals.ceil.compatible));
 assert.equal(controls[2].separatelyRoundedSumIntervals.round.compatible,false);
 assert.ok(controls.every(c=>!c.separatelyRoundedSumIntervals.floor.compatible));
 assert.ok(controls.every(c=>c.display.passiveAfterBoard!==c.observed.passive));
 const nextIds=ab.memberIds.map(id=>id==='card-00026-5-uniq-0065-00'?'card-06002-5-uniq-0058-00':id);
 const nextObservation={sampleId:'AC',leaderId:ab.leaderId,memberIds:nextIds,
  profiles:[ab.leaderId,...nextIds].map(id=>({... (ab.profiles.find(p=>p.id===id)??fixture.profiles.find(p=>p.id===id))}))};
 const nf=displayedActiveFeatures(nextObservation),nsp=quantizedSupportSP(nf),nb=boardPassiveFeatures(nextObservation);
 assert.ok(nf.conditions.passiveSupport.every(v=>v===0));assert.equal(nf.conditions.leaderScoreSupport,0);assert.equal(nf.conditions.leaderParameterConditionMet,false);
 assert.equal(nf.power.memberParameter,86545);assert.equal(nf.power.passive,17476);assert.equal(nf.power.outfit,0);assert.equal(nf.retainedPower,104021);
 assert.equal(nf.A,68.4);assert.equal(nsp.display,40.7);assert.equal(nb.display.combined,1.6);assert.ok(nb.display.passiveAfterBoard===0);
 assert.equal(nb.both,nb.boardOnly);assert.equal(nb.passiveOnly,nb.base);
 assert.ok(!rows.some(r=>[...r.memberIds].sort().join(',')===[...nextIds].sort().join(',')));
 const alternatives=[];
 for(const probabilityBoost of ['relative','absolute'])for(const cooldownMode of ['multiply','divide'])for(const cooldownRounding of ['raw','floor','round','ceil']){
  const config={probabilityBoost,cooldownMode,cooldownRounding},b=boardPassiveFeatures(nextObservation,config);
  alternatives.push({config,raw:b.raw.combined,display:b.display.combined});
 }
 assert.equal(hash(checkpoint),checkpointHash);assert.deepEqual(sourceLock(),plan.sourceHashes);
 return {schemaVersion:1,recordedAt:new Date().toISOString(),scope:'AB failed joint-display prediction, conditional rounding feasibility, and a zero-score-support-passive AC control. No production changes.',
  observation:ab,comparisons,
  arithmetic:{reportedOverallPower:118253,memberPlusPassive,remainderAfterMemberAndPassive:remainder,
   remainderInterpretation:'With the planned inactive outfit, the unreported combined board/memory/enhancement power is 20610. Do not allocate it to individual categories.',
   reportedScoreBonus:124.8,sumOfSuppliedBonusRows:suppliedBonusSum,bonusSumMatches:true,retainedBonusAfterDisplayedBoard:119.1,
   AAtoAB:{overallPower:ab.game.overallPower-aa.game.overallPower,memberParameter:-16226,passivePower:-8914,remainder:101,
    active:2.6,special:1.4,passiveScore:1,boardScore:2.4,bonusSumChange:7.4,bonusSumChangeBasis:'AB reported total minus AA derived sum, not two reported totals.'}},
  controls,
  conclusion:{jointPrediction:'Failed: frozen one-ceil 7.4 versus measured board5.7+passive1.8=7.5. Zero successes from one independent joint-display test.',
   rounding:'The unrounded joint candidate 7.374179 lies inside (7.3,7.5], the possible raw-sum interval if the two AB categories are separately ceiled to0.1. This is compatibility only, not a repaired prediction or a solved split.',
   individualFailure:'The unchanged marginal allocation still predicts board4.5/passive3.0 for AB. Rounding alone cannot convert those individual values into5.7/1.8.',
   commonContext:'Z/AA/AB all have the same Suisei leader and the same two support8 recipients, but measured passive is1.5/0.8/1.8. A general composition-dependent formula is still required.',
   scope:'W/X/Y/Z leader-context evidence remains separate. Baseline Active/SP still exclude boards; board involvement is being tested in a distinct research model.'},
  summary:{observations:26,distinctMemberSets,activeMatches:26,refinedSPMatches:26,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberChecks:['W','AA','AB'],sameMemberLeaderChecks:['X','Y','Z']},
   jointCandidateEvidence:{retrospectiveDisplayMatches:2,independentTests:1,independentDisplayMatches:0,independentDisplayFailures:['AB'],
    separateCeilCompatibility:{samples:['Z','AA','AB'],status:'Post-AB interval check only; not three predicted individual-category successes.'}},
   passiveStatus:'Individual formula unresolved.'},
  rows,
  next:{...nextObservation,features:nf,quantized:nsp,boardFeatures:nb,alternatives,
   change:'From AB keep Suisei leader, Ayame, Towa, Raden and regular Flare11/0; replace swimsuit Watame70/1 with regular Kanade80/0.',
   purpose:'Remove every score-support passive so the same candidate can be tested directly against the board category, without an unknown board/passive split.',
   hypotheses:{active:{display:nf.A,kind:'Existing board-excluded research formula'},special:{display:nsp.display,kind:'Existing board-excluded research formula'},
    passive:{display:0,kind:'No score-support passive according to member card effects; zero or an absent UI row expected, still to be measured.'},
    board:{display:nb.display.combined,kind:'Unchanged unrounded-interval frequency-divisor candidate; unconfirmed board formula.'},
    totalScoreBonus:{display:clean(nf.A+nsp.display+nb.display.combined),kind:'Conditional sum if only Active, board and SP contribute.'}},
   assumptions:'Same pre-song formation view; no related Suisei leader boards; no active leader outfit; Ayame singer effect excluded. Regular Flare40combo, regular Kanade100combo and Raden life600 conditions treated as met. Existing levels and board unlocks unchanged.',
   limitations:'The removed card also changes Active, SP, power-passive conditions and member boards, all evaluated by their respective candidates. This is a no-score-support-passive control, not a no-passive-power or board-free formation.',
   interpretation:{match:'Supports the board candidate for one composition with zero score-support passive. Does not solve the positive-passive allocation.',
    boardMismatch:'Record the board prediction failure and revisit the raw timing/probability/category calculation before using rounding to explain AB.',
    passivePresent:'Verify formation and the category context; do not assume a parameter-passive-only team must have zero displayed passive score after this observation.'},
   requestedMeasurements:'Member parameter, passive power, Active, board, SP, total score bonus, and whether the passive score row is absent or has a value.'},
  provenance:{ABCheckpointSHA256:checkpointHash,ABObservationSHA256:hash('analysis/unit-score/observations/AB-20260909.json'),
   sourceHashes:sourceLock(),newEvidenceHashes:plan.newEvidenceHashes,previousObservationHashes:plan.observationHashes,
   previousAnalysisSourceSHA256:plan.analysisSourceSHA256,previousComparisonSourceSHA256:plan.comparisonSourceSHA256,predictionsAndProductionUnchanged:true}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareABAndPlanAC(),null,2));
