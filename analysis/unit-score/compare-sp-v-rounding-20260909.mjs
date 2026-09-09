import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture} from './validation-data.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const round=(x,digits,mode='ceil')=>{
 const scale=10**digits;
 return (mode==='ceil'?Math.ceil(x*scale-1e-9):mode==='floor'?Math.floor(x*scale+1e-9):Math.round(x*scale))/scale;
};

// Research candidate found after V; not an implemented production rule.
export function quantizedSupportSP(features){
 const contributions=features.SP.map(s=>({...s,rawSupport:s.support*s.duration/120,
  roundedSupport:round(s.support*s.duration/120,2),rateContribution:s.rate/20}));
 const supportSum=contributions.reduce((sum,s)=>sum+s.roundedSupport,0);
 const factor=supportSum+features.rateSum/20;
 const raw=features.A*factor/100;
 return {contributions,supportSum,factor,raw,display:round(raw,1)};
}

export function compareVAndProbeRounding(){
 const frozenPath='analysis/unit-score/experiments/baseline-sp-V-20260909.json';
 const frozen=read(frozenPath),frozenHash=hash(frozenPath);
 assert.deepEqual(sourceLock(),frozen.sourceHashes);
 assert.equal(hash('analysis/unit-score/probe-sp-displayed-active-20260909.mjs'),frozen.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-sp-U-20260909.json'),frozen.UCheckpointSHA256);
 const observations=[...fixture.observations,...['M','O','P','Q','R','S','T','U','V'].map(id=>read(`analysis/unit-score/observations/${id}-20260909.json`))];
 const rows=observations.map(o=>{const f=displayedActiveFeatures(o);return {...f,quantized:quantizedSupportSP(f)};});
 const v=rows.find(r=>r.id==='V'),vo=observations.find(o=>o.sampleId==='V');
 assert.deepEqual(vo.memberIds,frozen.memberIds);assert.deepEqual(vo.profiles,frozen.profiles);
 assert.equal(vo.predictionCheckpointSHA256,frozenHash);
 const comparisons=['memberParameter','outfit','passive'].map(key=>({item:key,predicted:frozen.features.power[key],observed:vo.game.powerDetail[key]}));
 comparisons.push({item:'retainedPower',predicted:frozen.features.retainedPower,observed:vo.game.powerDetail.memberParameter+vo.game.powerDetail.outfit+vo.game.powerDetail.passive},
  {item:'active',predicted:frozen.features.A,observed:vo.game.scoreBonusDetail.active},
  {item:'special',predicted:frozen.features.displayedActiveFlatRate.ceil,observed:vo.game.scoreBonusDetail.special});
 for(const c of comparisons){c.matches=c.predicted===c.observed;assert.ok(c.matches);}
 assert.equal(v.A,frozen.features.A);assert.equal(v.displayedActiveFlatRate.ceil,frozen.features.displayedActiveFlatRate.ceil);
 assert.ok(rows.every(r=>r.A===r.observedActive));
 assert.ok(rows.every(r=>r.quantized.display===r.observedSP));
 assert.equal(rows.length,20);
 const distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;
 assert.equal(distinctMemberSets,14);
 const baselineIds=['G','O','P','Q','R','S','T','U','V'];
 assert.ok(rows.filter(r=>baselineIds.includes(r.id)).every(r=>r.conditions.leaderScoreSupport===0&&r.conditions.passiveSupport.every(n=>n===0)));
 const variants=[];
 for(const digits of [0,1,2,3,4])for(const mode of ['ceil','round','floor'])for(const place of ['perCard','total'])for(const target of ['support','supportAndRate']){
  const values=rows.map(r=>{
   const parts=r.SP.map(s=>s.support*s.duration/120+(target==='supportAndRate'?s.rate/20:0));
   const factor=(place==='perCard'?parts.reduce((sum,x)=>sum+round(x,digits,mode),0):round(parts.reduce((sum,x)=>sum+x,0),digits,mode))+(target==='support'?r.rateSum/20:0);
   const raw=r.A*factor/100,display=round(raw,1);
   return {id:r.id,raw,display,observed:r.observedSP,matches:display===r.observedSP};
  });
  variants.push({digits,mode,place,target,matches:values.filter(v=>v.matches).length,values});
 }
 assert.equal(variants.length,60);
 const perfect=variants.filter(v=>v.matches===rows.length);
 assert.equal(perfect.length,2);
 assert.ok(perfect.every(v=>v.digits===2&&v.mode==='ceil'&&v.place==='perCard'));
 const q=observations.find(o=>o.sampleId==='Q');
 const memberIds=q.memberIds.map(id=>id==='card-00018-5-uniq-0068-00'?'card-00026-5-uniq-0065-00':id);
 const nextObservation={sampleId:'W',leaderId:q.leaderId,memberIds,
  profiles:[q.leaderId,...memberIds].map(id=>({...fixture.profiles.find(p=>p.id===id)}))};
 const nextFeatures=displayedActiveFeatures(nextObservation),nextRounded=quantizedSupportSP(nextFeatures);
 assert.equal(nextFeatures.conditions.leaderScoreSupport,0);
 assert.equal(nextFeatures.conditions.leaderParameterConditionMet,false);
 assert.equal(nextFeatures.conditions.passiveSupport.reduce((sum,x)=>sum+x,0),16);
 assert.equal(nextFeatures.SP.find(s=>s.id==='card-00022-5-uniq-0063-00').rate,0);
 assert.equal(nextFeatures.A,75.5);
 assert.equal(nextFeatures.displayedActiveFlatRate.ceil,43.1);
 assert.equal(nextRounded.display,43.2);
 assert.equal(nextFeatures.displayedActiveDurationRate.ceil,43.3);
 assert.ok(!rows.some(r=>[...r.memberIds].sort().join(',')===[...memberIds].sort().join(',')));
 assert.equal(hash(frozenPath),frozenHash);assert.deepEqual(sourceLock(),frozen.sourceHashes);
 return {recordedAt:new Date().toISOString(),scope:'V frozen-prediction comparison and post-V retrospective rounding diagnostic; research only.',
  formula:'A = ceil0.1(A_raw); q_i = ceil0.01(supportPct_i * duration_i / 120); SP = ceil0.1(A * [sum_i(q_i) + sum_i(effectiveRatePct_i)/20] / 100)',
  V:{observation:vo,comparisons,reportedOverallPower:vo.game.overallPower,retainedPower:v.retainedPower,
   excludedPowerAggregate:vo.game.overallPower-v.retainedPower,
   reportedScoreBonus:vo.game.scoreBonusPct,knownBonusSum:round(vo.game.scoreBonusDetail.active+vo.game.scoreBonusDetail.special+vo.game.scoreBonusDetail.board,1),
   historicalPredictionUnchanged:true,frozenCheckpointSHA256:frozenHash,
   evidence:'First independent success of the complete displayed-Active formula frozen after U. V has no fractional per-card support contributions and does not distinguish the newly found inner rounding.'},
  summary:{observations:rows.length,distinctMemberSets,activeMatches:rows.filter(r=>r.A===r.observedActive).length,
   originalSPMatches:rows.filter(r=>r.displayedActiveFlatRate.ceil===r.observedSP).length,
   refinedSPMatches:rows.filter(r=>r.quantized.display===r.observedSP).length,zeroScoreSupportBaselineMatches:baselineIds.length,
   evidenceStatus:'The quantization rule was discovered after V; all 20 matches are retrospective checks of that refinement, not 20 independent prediction successes.'},
  rows,roundingGrid:{scope:'60 alternatives with displayed Active and final ceil0.1 held fixed; not an exhaustive proof over all formulas.',variants,
   perfectVariants:perfect.map(({values,...v})=>v),equivalence:'All current effective rates are multiples of 5%; rate/20 is an exact multiple of 0.01. Rounding support before adding rate and rounding their sum per card are indistinguishable here.'},
  next:{...nextObservation,features:nextFeatures,quantized:nextRounded,
   change:'Q: replace swimsuit Suisei 60/0 with swimsuit Watame 70/1. Keep Ririka leader, Ayame, Towa, Raden, swimsuit Noel.',
   purpose:'A new member set separates unrounded support (43.1), per-card support ceil0.01 (43.2), and the unrounded duration-weighted-rate alternative (43.3).',
   assumptions:'Raden life >=600; Ayame Pure-member condition met. Ririka leader parameter condition and Noel generation-3 condition are unmet. Boards excluded.',
   limitation:'Watame introduces a nonzero score-support passive (8% to Watame and Raden). This is not a pure no-passive rounding control. A match supports the candidate but cannot uniquely distinguish rounding from all possible passive interactions.'},
  limitations:['No measured Unit Score or played-song scores.','No general passive-bonus or leader-outfit-bonus formula established by V.',
   '20 rows include repeats and leader swaps; there are 14 distinct member sets.','The constants and rounding may be an equivalent model, not proof of the internal game implementation.'],
  sourceHashes:sourceLock()};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareVAndProbeRounding(),null,2));
