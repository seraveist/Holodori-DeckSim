import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture,prepared} from './validation-data.mjs';
import {prepareDeckComposition} from '../../js/score.js';
import {integrate,round1,boards} from './dummy-model-lab.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(9));

function passiveProbe(o){
 // Z and AA use the exact original fixture profiles. Other growth settings require fresh preparation.
 for(const p of o.profiles)assert.deepEqual(p,fixture.profiles.find(x=>x.id===p.id));
 const members=o.memberIds.map(id=>prepared.get(id));
 const composition=prepareDeckComposition({leader:prepared.get(o.leaderId),members});
 const team={members,support:members.map(m=>composition.passive.supportByMember[m.id])};
 const candidates=['weighted','maximum'].map(aggregation=>{
  const base=integrate(team,{aggregation,board:false});
  const withPassive=integrate(team,{aggregation,board:false,passive:true});
  return {aggregation,board:false,base,withPassive,raw:withPassive-base,display:round1(withPassive-base),
   observed:o.game.scoreBonusDetail.passive,matches:round1(withPassive-base)===o.game.scoreBonusDetail.passive};
 });
 return {id:o.sampleId,candidates,missingLegacyMemberBoardTimingInputs:members.filter(m=>!boards.has(m.characterId)).map(m=>m.characterId),
  boardScope:'The legacy board map contains timing/rate inputs only. The subsequent AA-member-clarification supplement supplies the Ayame pre-song interpretation; probe-passive-board-aa handles that separately. Ayame leader-board absence alone does not establish member-board absence.'};
}

export function compareAA(){
 const checkpoint='analysis/unit-score/experiments/baseline-passive-AA-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 const sourceHashes=sourceLock();assert.deepEqual(sourceHashes,plan.sourceHashes);
 assert.equal(hash('analysis/unit-score/compare-passive-z-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-passive-Z-20260909.json'),plan.ZCheckpointSHA256);
 for(const [p,h] of Object.entries(plan.newEvidenceHashes))assert.equal(hash(p),h);
 const observations=[...fixture.observations,...['M','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA'].map(id=>read(`analysis/unit-score/observations/${id}-20260909${id==='Z'?'-completed':''}.json`))];
 const rows=observations.map(o=>{const f=displayedActiveFeatures(o);return {...f,quantized:quantizedSupportSP(f)};});
 const aa=observations.find(o=>o.sampleId==='AA'),z=observations.find(o=>o.sampleId==='Z');
 const aaf=rows.find(r=>r.id==='AA'),zf=rows.find(r=>r.id==='Z');
 assert.equal(aa.predictionCheckpointSHA256,checkpointHash);assert.equal(aa.leaderId,plan.leaderId);
 assert.deepEqual(aa.memberIds,plan.memberIds);assert.deepEqual(aa.profiles,plan.profiles);
 assert.equal(observations.length,25);assert.equal(new Set(observations.map(o=>o.sampleId)).size,25);
 const distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;assert.equal(distinctMemberSets,16);
 assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 const comparisons=[
  {item:'memberParameter',kind:'calculated',predicted:plan.features.power.memberParameter,observed:aa.game.powerDetail.memberParameter},
  {item:'passivePower',kind:'calculated',predicted:plan.features.power.passive,observed:aa.game.powerDetail.passive},
  {item:'active',kind:'research formula',predicted:plan.features.A,observed:aa.game.scoreBonusDetail.active},
  {item:'special',kind:'research formula',predicted:plan.quantized.display,observed:aa.game.scoreBonusDetail.special},
  {item:'passiveScore',kind:'recipient-only invariance hypothesis',predicted:plan.passiveHypothesis.display,observed:aa.game.scoreBonusDetail.passive},
  {item:'boardScore',kind:'no prediction',predicted:plan.boardPrediction.display,observed:aa.game.scoreBonusDetail.board}
 ].map(c=>({...c,matches:c.predicted===null?null:c.predicted===c.observed,delta:c.predicted===null?null:clean(c.observed-c.predicted)}));
 assert.ok(comparisons.slice(0,4).every(c=>c.matches));assert.equal(comparisons[4].matches,false);assert.equal(comparisons[4].delta,-0.7);
 assert.equal(aa.game.scoreBonusPct,null);assert.equal(aa.game.powerDetail.outfit,null);
 assert.equal(aaf.power.outfit,0);assert.equal(aaf.conditions.leaderScoreSupport,0);assert.equal(aaf.conditions.leaderParameterConditionMet,false);
 assert.equal(aa.leaderId,z.leaderId);assert.deepEqual(aaf.conditions.passiveSupport,zf.conditions.passiveSupport);
 const recipients=aaf.memberIds.filter((_,i)=>aaf.conditions.passiveSupport[i]>0);
 assert.deepEqual(recipients,['card-06004-5-uniq-0060-00','card-00026-5-uniq-0065-00']);
 for(const id of recipients){assert.deepEqual(aaf.conditions.active.find(m=>m.id===id),zf.conditions.active.find(m=>m.id===id));}
 assert.equal(aaf.memberIds.filter(id=>prepared.get(id).attribute===3).length,2);
 const observedFields=o=>({overallPower:o.game.overallPower,memberParameter:o.game.powerDetail.memberParameter,passivePower:o.game.powerDetail.passive,
  active:o.game.scoreBonusDetail.active,special:o.game.scoreBonusDetail.special,passiveScore:o.game.scoreBonusDetail.passive,boardScore:o.game.scoreBonusDetail.board});
 const zFields=observedFields(z),aaFields=observedFields(aa);
 const delta=Object.fromEntries(Object.keys(zFields).map(k=>[k,clean(aaFields[k]-zFields[k])]));
 assert.deepEqual(delta,{overallPower:9590,memberParameter:0,passivePower:9947,active:-4.4,special:-1,passiveScore:-0.7,boardScore:-3.6});
 const memberPlusPassive=aa.game.powerDetail.memberParameter+aa.game.powerDetail.passive,remainder=aa.game.overallPower-memberPlusPassive;
 assert.equal(memberPlusPassive,122783);assert.equal(memberPlusPassive,plan.features.retainedPower);assert.equal(remainder,20509);
 const suppliedRowSum=clean(Object.values(aa.game.scoreBonusDetail).filter(v=>v!==null).reduce((s,v)=>s+v,0));assert.equal(suppliedRowSum,117.4);
 const probes=[z,aa].map(passiveProbe);
 assert.ok(probes.every(p=>p.candidates.every(c=>!c.matches)));
 const intervals=['ceil','round','floor'].map(mode=>{
  const offsets=mode==='ceil'?[-.1,0]:mode==='round'?[-.05,.05]:[0,.1];
  const perSample=probes.map(p=>{const c=p.candidates.find(c=>c.aggregation==='weighted');
   return {id:p.id,lower:(c.observed+offsets[0])/c.raw,upper:(c.observed+offsets[1])/c.raw};});
  const lower=Math.max(...perSample.map(p=>p.lower)),upper=Math.min(...perSample.map(p=>p.upper));
  assert.ok(lower>upper);
  return {mode,perSample,commonScalePossible:false,lower,upper};
 });
 const changedCards=[z.memberIds.find(id=>!aa.memberIds.includes(id)),aa.memberIds.find(id=>!z.memberIds.includes(id))].map((id,i)=>{
  const m=prepared.get(id),f=i===0?zf:aaf;
  return {sample:i===0?'Z':'AA',id,name:m.characterName,attribute:m.attribute,stats:m.stats,
   active:m.active,special:m.special,effectiveSP:f.SP.find(s=>s.id===id),passive:m.passive,
   recordedMemberBoardTiming:boards.get(m.characterId),scoreSupportPassiveApplied:f.conditions.passiveSupport[f.memberIds.indexOf(id)]};
 });
 assert.equal(hash(checkpoint),checkpointHash);assert.deepEqual(sourceLock(),sourceHashes);
 return {schemaVersion:1,recordedAt:new Date().toISOString(),scope:'AA frozen prediction comparison and same-leader passive-context diagnosis. No production formula change.',
  observation:aa,comparisons,
  arithmetic:{reportedOverallPower:143292,memberPlusPassive,remainderAfterMemberAndPassive:remainder,remainderChangeFromZ:-357,
   remainderInterpretation:'Under the planned inactive outfit, combined board/memory/enhancement remainder; individual values were not supplied.',
   reportedScoreBonus:null,sumOfSuppliedBonusRows:suppliedRowSum,sumStatus:'Derived only. Total score bonus and outfit score row were not supplied.',
   suppliedBonusSumMinusReportedZTotal:-9.7},
  ZtoAA:{Z:zFields,AA:aaFields,delta,changedCards,
   fixed:{leaderId:aa.leaderId,leaderScoreSupport:0,leaderParameterConditionMet:false,recipients,supportPerRecipient:8,recipientActiveConditionsAndValuesUnchanged:true,exactlyTwoHappyMembers:true},
   changed:{memberActive:'Noel: 21s / 55% / 7s / 120; regular Kanade: 27s / 55% / 12s / 75.',
    SP:'Noel duration12 support100, rate condition unmet =>0; Kanade duration10 support120, combo condition assumed met =>45. Duration×support stays1200.',
    parameterPassives:'Regular Kanade adds a RegLOSS sense passive and changes the eligible parameter-passive targets. These power changes are calculated separately.',
    memberBoards:'Recorded rate/cooldown changes from 23.5/4 to 20/0. The subsequent AA clarification reconfirms Noel/Kanade unchanged and identifies Ayame singer-conditional-only nodes; see the separate board-interaction probe.'},
   conclusion:'The frozen recipient-only passive invariance hypothesis is rejected. Additional composition context is required even with an unchanged leader and unchanged support recipients.',
   limitations:['This swap changes several card skills, stat-passive context and member boards simultaneously; it cannot identify Active, SP or board effects individually.',
    'A simultaneous board-row decrease is not proof of board causality or a passive-to-board coefficient.',
    'The earlier W/X/Y/Z leader-context result remains valid for that member set. This new composition effect does not erase it.',
    'The hypothesis failure does not establish a universal 0.7 reduction for Noel-to-Kanade swaps.']},
  passiveDiagnostics:{probes,commonPositiveScaleOfWeightedMargin:intervals,
   conclusion:'The prior board-excluded support margin predicts 2.6 for both Z and AA. No shared multiplicative constant can match 1.5 and 0.8 under common ceil/round/floor0.1. The tested expected-maximum alternative also misses.',
   remaining:'Other full-team aggregation and category allocation formulas, including board interactions, remain open.'},
  summary:{observations:25,distinctMemberSets,activeMatches:25,refinedSPMatches:25,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberChecks:['W','AA'],sameMemberLeaderChecks:['X','Y','Z'],
    roundingDiscrimination:'W distinguishes per-card ceil0.01 from unrounded support. AA matches both at 42.2, so AA is a new-member generalization check, not another rounding discriminator.',
    rejectedAlternativeForAA:{durationWeightedRate:42.4,observed:42.2}},
   passiveStatus:'Unresolved; recipient-only invariance rejected by AA.'},
  next:{status:'Member-board clarification received in board-observations/AA-member-clarification-20260909.json. Continue with probe-passive-board-aa-20260909.mjs for the post-AA combined candidate and AB checkpoint.',
   purpose:'Compare documented member-board interactions before assigning the observed passive decrease to a particular skill.',
   clarification:'Ayame has only singer-conditional nodes; Noel/Kanade are unchanged. Exclude singer effects under the inherited pre-song-selection context without inventing their unknown values.',
   scope:'Keep board-excluded baseline Active/SP intact. Do not infer absent member effects from absent leader effects or silently fill missing boards with zero.'},
  rows,provenance:{AAObservationSHA256:hash('analysis/unit-score/observations/AA-20260909.json'),AACheckpointSHA256:checkpointHash,
   ZCurrentObservation:'analysis/unit-score/observations/Z-20260909-completed.json',ZCurrentObservationSHA256:hash('analysis/unit-score/observations/Z-20260909-completed.json'),
   historicalZPartialPreserved:true,sourceHashes,newEvidenceHashes:plan.newEvidenceHashes,predictionsAndProductionUnchanged:true}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareAA(),null,2));
