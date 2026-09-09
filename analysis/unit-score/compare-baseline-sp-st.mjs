import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {probeBaselineSP} from './probe-baseline-sp-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const delta=(a,b)=>Number((a-b).toFixed(9));

function coefficientFeasibility(rows,mode){
 const bounds=rows.map(r=>({...r,lo:r.observed-(mode==='ceil'?.1:mode==='round'?.05:0),hi:r.observed+(mode==='floor'?.1:mode==='round'?.05:0)}));
 let min=-Infinity,max=Infinity,minWitness=null,maxWitness=null;
 // Eliminate kRate from lo <= kSupport*S + kRate*R <= hi.
 // All rows have R>0. Allow every real coefficient and closed rounding endpoints.
 for(const lower of bounds)for(const upper of bounds){
  assert.ok(lower.R>0&&upper.R>0);
  const a=upper.S*lower.R-lower.S*upper.R,b=upper.hi*lower.R-lower.lo*upper.R;
  if(a>1e-12&&b/a<max){max=b/a;maxWitness=[lower.id,upper.id];}
  if(a< -1e-12&&b/a>min){min=b/a;minWitness=[lower.id,upper.id];}
 }
 return {mode,supportCoefficientMinimum:min,supportCoefficientMaximum:max,minWitness,maxWitness,
   feasibleEvenWithUnrestrictedSignsAndClosedBounds:min<=max+1e-9};
}

export function compareBaselineST(){
 const planPath='analysis/unit-score/experiments/baseline-sp-ST-20260909.json',plan=read(planPath);
 const sources=sourceLock();assert.deepEqual(sources,plan.sourceHashes);
 assert.equal(hash(plan.coefficientSource),plan.coefficientFileSHA256);
 const baseline=probeBaselineSP();
 const rows=[...baseline.rows];
 const observations=['S','T'].map(id=>read(`analysis/unit-score/observations/${id}-20260909.json`));
 const comparisons=observations.map(o=>{
  const p=plan.experiments.find(p=>p.sampleId===o.sampleId);
  const computed=baseline.nextExperiments.find(e=>e.sampleId===o.sampleId).features;
  assert.deepEqual(o.memberIds,p.memberIds);assert.equal(o.leaderId,p.leaderId);assert.deepEqual(o.profiles,p.profiles);
  assert.deepEqual(computed.power,p.features.power);
  for(const key of ['memberParameter','outfit','passive'])if(o.game.powerDetail[key]!==null)assert.equal(computed.power[key],o.game.powerDetail[key]);
  const b=o.game.scoreBonusDetail;
  assert.equal(computed.activeDisplay,b.active);assert.equal(p.predictions.active,b.active);
  assert.equal(delta(b.active+b.board+b.special,o.game.scoreBonusPct),0);
  rows.push({...computed,observed:b.special});
  const predictions=Object.fromEntries(['oldSingle','oldTwo','newScaledSupport'].map(key=>[key,{
   frozenRaw:p.predictions[key].raw,frozenDisplay:p.predictions[key].ceil,observed:b.special,
   errorPp:delta(p.predictions[key].ceil,b.special),matches:p.predictions[key].ceil===b.special}]));
  const range=p.predictions.newTwoCoefficientRawRange;
  return {id:o.sampleId,retainedPower:computed.retainedPower,reportedPowerComponentsMatch:true,
   outfitPowerZeroIsInferred:o.game.powerDetail.outfit===null,
   excludedPowerAggregate:o.game.overallPower-computed.retainedPower,
   retainedBonus:delta(o.game.scoreBonusPct,b.board),rateSPCount:computed.rateSPCount,
   active:{frozen:p.predictions.active,observed:b.active,matches:true},special:predictions,
   frozenTwoCoefficientFamily:{rawRange:range,observedCeilRawInterval:{lower:b.special-.1,upper:b.special},
     disjoint:range.max<b.special-.1||range.min>b.special}};
 });
 const feasibility=['ceil','round','floor'].map(mode=>coefficientFeasibility(rows,mode));
 assert.ok(feasibility.every(f=>!f.feasibleEvenWithUnrestrictedSignsAndClosedBounds));
 assert.ok(comparisons.every(c=>c.frozenTwoCoefficientFamily.disjoint));
 const minimalCertificate=['ceil','round','floor'].map(mode=>coefficientFeasibility(rows.filter(r=>['G','P','T'].includes(r.id)),mode));
 assert.ok(minimalCertificate.every(f=>!f.feasibleEvenWithUnrestrictedSignsAndClosedBounds));
 assert.deepEqual(sourceLock(),sources);
 return {recordedAt:new Date().toISOString(),scope:'New S/T observations compared with frozen predictions, followed by retrospective model rejection over seven zero-score-support-passive formations.',
  comparisons,rows,feasibility,minimalCertificate,
  conclusion:'The frozen scaled-support candidate fails both S/T. No fixed pair of coefficients on the existing whole-window support/rate features can explain G/O/P/Q/R/S/T, even with unrestricted signs and ceil/round/floor intervals. The feature/application model itself needs revision; this does not reject every possible two-component SP formula.',
  limitation:'Rate-SP count, receiving Active profiles, and parameter effects change together in S/T. Residuals do not prove that count alone is the causal variable or that the error is confined to the rate term.',
  sourceHashes:sources,predictionCheckpoint:planPath,predictionCheckpointSHA256:hash(planPath),
  coefficientFileSHA256:hash(plan.coefficientSource),historicalPredictionsAndCoefficientsUnchanged:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareBaselineST(),null,2));
