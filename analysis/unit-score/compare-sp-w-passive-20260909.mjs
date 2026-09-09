import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture,prepared} from './validation-data.mjs';
import {prepareDeckComposition} from '../../js/score.js';
import {integrate,round1,condition} from './dummy-model-lab.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');

function passiveDiagnostic(o){
 // This diagnostic is called only for E/H/W; their profiles match the original
 // fixture, including historical H's general Flare at level 1.
 for(const p of o.profiles??fixture.profiles)assert.deepEqual(p,fixture.profiles.find(f=>f.id===p.id));
 const leader=prepared.get(o.leaderId),members=o.memberIds.map(id=>prepared.get(id));
 const c=prepareDeckComposition({leader,members});
 const team={members,support:members.map(m=>c.passive.supportByMember[m.id])};
 const base=integrate(team,{board:false}),withPassive=integrate(team,{board:false,passive:true});
 const raw=withPassive-base;
 return {id:o.sampleId,observedActive:o.game.scoreBonusDetail.active,observedPassive:o.game.scoreBonusDetail.passive,
  leaderId:o.leaderId,leaderParameterConditionMet:c.primaryMet,leaderScoreSupport:c.leaderEffects.support,
  assumedRecipients:members.map((m,i)=>({id:m.id,name:m.characterName,support:team.support[i],
   active:{interval:m.active.interval,probability:m.active.probability,duration:m.active.duration,
    effectiveValue:condition(m.active.condition,team)?m.active.conditionalScoreUp:m.active.baseScoreUp}})).filter(m=>m.support>0),
  happyMembers:members.filter(m=>m.attribute===3).map(m=>({id:m.id,name:m.characterName})),
  linearPassiveRaw:raw,linearPassiveDisplay:round1(raw),
  recipientStatus:'Assignments from the current research/production target-selection implementation, not individually measured in-game targets.'};
}

export function compareWAndPlanX(){
 const checkpoint='analysis/unit-score/experiments/baseline-sp-W-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 assert.equal(hash('analysis/unit-score/compare-sp-v-rounding-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-sp-V-20260909.json'),plan.VCheckpointSHA256);
 const observations=[...fixture.observations,...['M','O','P','Q','R','S','T','U','V','W'].map(id=>read(`analysis/unit-score/observations/${id}-20260909.json`))];
 const wo=observations.find(o=>o.sampleId==='W');
 assert.deepEqual(wo.memberIds,plan.memberIds);assert.deepEqual(wo.profiles,plan.profiles);
 assert.equal(wo.leaderId,plan.leaderId);assert.equal(wo.predictionCheckpointSHA256,checkpointHash);
 const rows=observations.map(o=>{const f=displayedActiveFeatures(o);return {...f,quantized:quantizedSupportSP(f)};});
 const w=rows.find(r=>r.id==='W');
 assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 assert.equal(rows.length,21);
 const distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;
 assert.equal(distinctMemberSets,15);
 const comparisons=['memberParameter','passive'].map(item=>({item,predicted:plan.features.power[item],observed:wo.game.powerDetail[item]}));
 comparisons.push({item:'active',predicted:plan.features.A,observed:wo.game.scoreBonusDetail.active},
  {item:'specialWithCardRounding',predicted:plan.quantized.display,observed:wo.game.scoreBonusDetail.special});
 for(const c of comparisons){c.matches=c.predicted===c.observed;assert.ok(c.matches);}
 assert.equal(w.retainedPower,plan.features.retainedPower);
 assert.equal(wo.game.powerDetail.outfit,null);
 const spAlternatives=[
  {model:'No per-card support rounding; flat rate sum',predicted:plan.features.displayedActiveFlatRate.ceil},
  {model:'Per-card support ceil0.01; flat rate sum',predicted:plan.quantized.display},
  {model:'No per-card support rounding; duration-weighted rates',predicted:plan.features.displayedActiveDurationRate.ceil}
 ].map(x=>({...x,observed:wo.game.scoreBonusDetail.special,matches:x.predicted===wo.game.scoreBonusDetail.special}));
 assert.deepEqual(spAlternatives.map(r=>r.matches),[false,true,false]);
 const knownBonusSum=Number(Object.values(wo.game.scoreBonusDetail).filter(x=>x!==null).reduce((s,x)=>s+x,0).toFixed(9));
 assert.equal(knownBonusSum,wo.game.scoreBonusPct);
 const passive=['E','H','W'].map(id=>passiveDiagnostic(observations.find(o=>o.sampleId===id)));
 const e=passive[0],wd=passive[2];
 const signature=r=>r.assumedRecipients.map(m=>JSON.stringify(m)).sort();
 assert.deepEqual(signature(e),signature(wd));
 assert.ok(e.linearPassiveRaw<wd.linearPassiveRaw&&e.observedPassive>wd.observedPassive);
 assert.equal(e.leaderParameterConditionMet,true);assert.equal(wd.leaderParameterConditionMet,false);
 const nextLeaderId='card-06002-5-uniq-0066-00';
 const nextObservation={sampleId:'X',leaderId:nextLeaderId,memberIds:wo.memberIds,
  profiles:[nextLeaderId,...wo.memberIds].map(id=>({...fixture.profiles.find(p=>p.id===id)}))};
 const nextFeatures=displayedActiveFeatures(nextObservation),nextSP=quantizedSupportSP(nextFeatures);
 assert.equal(nextFeatures.conditions.leaderScoreSupport,0);
 assert.equal(nextFeatures.conditions.leaderParameterConditionMet,true);
 assert.deepEqual(nextFeatures.conditions.passiveSupport,w.conditions.passiveSupport);
 assert.equal(nextFeatures.power.memberParameter,w.power.memberParameter);
 assert.equal(nextFeatures.power.passive,w.power.passive);
 assert.ok(nextFeatures.power.outfit>0);
 assert.equal(nextFeatures.A,w.A);assert.equal(nextSP.display,w.observedSP);
 const nextLeader=prepared.get(nextLeaderId);
 assert.deepEqual(nextLeader.leader.primaryEffects,{p:130,t:0,s:0,support:0});
 assert.equal(hash(checkpoint),checkpointHash);assert.deepEqual(sourceLock(),plan.sourceHashes);
 return {recordedAt:new Date().toISOString(),scope:'W frozen-prediction validation, passive diagnostics, and future X control. No production formula change.',
  W:{observation:wo,comparisons,spAlternatives,retainedPower:w.retainedPower,
   retainedPowerBasis:'Member parameter 100252 + passive 12584 = 112836. Outfit is unreported; zero is inferred from the planned unmet leader condition.',
   excludedPowerAggregateAssumingZeroOutfit:wo.game.overallPower-w.retainedPower,knownBonusSum,
   retainedBonus:wo.game.scoreBonusPct-wo.game.scoreBonusDetail.board,
   historicalCheckpointSHA256:checkpointHash,historyUnchanged:true,
   evidence:'First independent discriminating match for the per-card support rounding candidate frozen after V. All earlier 20 matches were retrospective for this refinement. W includes a score-support passive, so the result does not rule out all alternative interactions.'},
  summary:{observations:21,distinctMemberSets,activeMatches:21,refinedSPMatches:21,
   refinedSPEvidence:{retrospectiveRowsAtDiscovery:20,independentDiscriminatingMatches:1},
   directPowerComponentsMatched:comparisons.filter(c=>['memberParameter','passive'].includes(c.item)).length},
  rows,passiveDiagnostics:{rows:passive,
   findings:['Current target selection gives the same Watame/Raden 8% supports and the same recipient Active profiles in E/H/W, but displayed passive is 2.3/2.4/1.9.',
    'The 200-second linear score-support marginal predicts 2.6 for all three; E raw is below W raw, while E observed exceeds W observed. No nonnegative common multiplier followed by a common monotone rounding rule can reconcile E and W on this feature.',
    'E/H have three Happy members; W has exactly two. Support target prioritization in the three-Happy cases is an implementation assumption, not isolated in-game evidence.',
    'The same Ririka leader has its parameter outfit condition met in E/H and unmet in W. E/W does not isolate changes in other Active skills from parameter-outfit state or recipient-selection uncertainty.'],
   conclusion:'Passive is not solved. Do not attribute the difference exclusively to other Active skills, total Active, or leader outfit.'},
  next:{...nextObservation,leaderDescription:nextLeader.leader.description,features:nextFeatures,quantized:nextSP,
   passiveHypothesis:{display:wo.game.scoreBonusDetail.passive,status:'Conditional invariance hypothesis; not a solved passive formula.',
    condition:'If a leader outfit that only changes member parameters does not change displayed passive when all five members and both eligible support recipients are held fixed, X passive remains 1.9.'},
   change:'Keep W five members, levels and awakenings. Change only Ririka leader 40/0 to swimsuit Kanade leader 40/0.',
   purpose:'Switch on a parameter-only leader outfit while holding every member skill and the two eligible Happy support recipients fixed.',
   assumptions:'Member-only conditions. Happy >=2 makes Kanade leader performance +130% active; no leader score support. Raden life >=600 remains assumed met. Board corrections excluded.',
   requestedMeasurements:'Total power and member/outfit/passive power; total score bonus and Active, SP, passive, board, and outfit score rows or absence.',
   interpretation:{unchangedPassive:'Supports parameter-only outfit invariance for this W member set; then narrow member-skill and support-recipient dependence before Ayame leader.',
    changedPassive:'Parameter-outfit/leader context still needs examination even without score-support outfit; record changed fields before adding a coefficient.'},
   limitation:'One leader swap tests this member set and this parameter-only costume. It does not establish invariance for all leaders or solve score-support costumes such as Ayame.'},
  sourceHashes:sourceLock()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareWAndPlanX(),null,2));
