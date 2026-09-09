import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { prepareScoreCards } from '../../js/card-prepare.js';
import { prepareDeckComposition, evaluateDeck } from '../../js/score.js';
import { integrate, condition, round1 } from './dummy-model-lab.mjs';
import { sourceLock } from './io.mjs';
const root = new URL('../../',import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const fixture = read('scripts/fixtures/unit-observations-20260908.json');
const cards = read('data/generated/cards.json');
const characters = new Map(read('data/generated/characters.json').map(c=>[c.id,c]));
const masterRefs = read('data/generated/master_refs.json');
const coefficientSource = 'analysis/unit-score/archive/fixed-constant-fits-20260909-v2.json';
const old = read(coefficientSource).special;
const delta = (a,b) => Number((a-b).toFixed(9));

function features(o) {
 const profiles=o.profiles ?? fixture.profiles;
 const prepared=prepareScoreCards(cards,characters,Object.fromEntries(profiles.map(p=>[p.id,p])),{masterRefs,levelMode:'current'});
 const leader=prepared.get(o.leaderId),members=o.memberIds.map(id=>prepared.get(id));
 const composition=prepareDeckComposition({leader,members});
 const team={members,support:members.map(m=>composition.passive.supportByMember[m.id])};
 assert.equal(composition.leaderEffects.support,0);
 assert.ok(team.support.every(x=>x===0));
 const A=integrate(team,{board:false});let S=0,R=0;
 const perSP=members.map(m=>{
  const sp={...m.special,duration:201};
  const rate=integrate(team,{board:false,sp:{...sp,support:0},spStart:0});
  const both=integrate(team,{board:false,sp,spStart:0});
  const s=(both-rate)*m.special.duration/200,r=(rate-A)*m.special.duration/200;
  S+=s;R+=r;
  return {id:m.id,duration:m.special.duration,support:m.special.support,
    activationRateUp:condition(m.special.condition,team)?m.special.activationRateUp:0,S:s,R:r};
 });
 const engine=evaluateDeck({leader,members});
 return {id:o.sampleId,A,activeDisplay:round1(A),S,R,perSP,rateSPCount:perSP.filter(x=>x.activationRateUp>0).length,
  power:engine.detail.power,retainedPower:engine.overallPower,
  observed:o.game?.scoreBonusDetail.special ?? null,
  oldSingleRaw:(S+R)*old.single.coefficients[0],
  oldTwoRaw:S*old.separateSupportAndRate.coefficients[0]+R*old.separateSupportAndRate.coefficients[1],
  conditions:{leaderParameterConditionMet:composition.primaryMet,leaderScoreSupport:0,passiveScoreSupport:team.support,
    activeConditions:members.map(m=>({id:m.id,condition:m.active.condition,assumedMet:condition(m.active.condition,team)}))}};
}

function region(rows,mode='ceil',nonnegative=false) {
 const bounds=rows.map(r=>({...r,lo:r.observed-(mode==='ceil'?.1:mode==='round'?.05:0),hi:r.observed+(mode==='floor'?.1:mode==='round'?.05:0)}));
 const lines=bounds.flatMap(r=>[{S:r.S,R:r.R,y:r.lo},{S:r.S,R:r.R,y:r.hi}]);
 if(nonnegative)lines.push({S:1,R:0,y:0},{S:0,R:1,y:0});
 const vertices=[];
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
  const a=lines[i],b=lines[j],d=a.S*b.R-b.S*a.R;if(Math.abs(d)<1e-12)continue;
  const co=[(a.y*b.R-b.y*a.R)/d,(a.S*b.y-b.S*a.y)/d];
  if(nonnegative&&co.some(x=>x< -1e-8))continue;
  if(bounds.every(r=>{const v=r.S*co[0]+r.R*co[1];return v>=r.lo-1e-8&&v<=r.hi+1e-8}))vertices.push(co);
 }
 return {mode,nonnegative,closedIntervalFeasible:vertices.length>0,vertices,
  note:'Closed rounding endpoints are conservative relaxations; boundary feasibility is not a unique exact formula.'};
}

export function probeBaselineSP() {
 const sources=sourceLock();
 const observations=['G','O','P','Q','R'].map(id=>id==='G'?fixture.observations.find(o=>o.sampleId===id):read(`analysis/unit-score/observations/${id}-20260909.json`));
 const rows=observations.map(features);
 for(const r of rows)assert.equal(r.rateSPCount,2);
 const regions=['ceil','round','floor'].map(mode=>region(rows,mode));
 const positiveRegion=region(rows,'ceil',true);
 const supportOnlyBounds={min:Math.max(...rows.map(r=>(r.observed-.1)/r.S)),max:Math.min(...rows.map(r=>r.observed/r.S))};
 const supportOnlyK=(supportOnlyBounds.min+supportOnlyBounds.max)/2;
 assert.ok(supportOnlyBounds.min<supportOnlyBounds.max);
 const supportOnlyChecks=rows.map(r=>({id:r.id,raw:r.S*supportOnlyK,ceil:round1(r.S*supportOnlyK),observed:r.observed}));
 assert.ok(supportOnlyChecks.every(r=>r.ceil===r.observed));
 const q=rows.find(r=>r.id==='Q'),r=rows.find(r=>r.id==='R');
 assert.equal(q.A,r.A);assert.equal(q.R,r.R);
 const latestProfiles=new Map(fixture.profiles.map(p=>[p.id,p]));
 for(const p of read('analysis/unit-score/observations/P-20260909.json').profiles)latestProfiles.set(p.id,p);
 const leaderId='card-06003-5-uniq-0059-00';
 const definitions=[{sampleId:'S',memberIds:['card-00010-5-uniq-0010-00','card-00018-5-uniq-0068-00','card-06002-5-uniq-0066-00','card-06004-5-uniq-0060-00','card-00022-5-uniq-0063-00']},
  {sampleId:'T',memberIds:['card-00010-5-uniq-0010-00','card-00018-5-uniq-0068-00','card-00021-5-uniq-0017-00','card-06004-5-uniq-0060-00','card-00027-5-uniq-0022-00']}];
 const next=definitions.map(d=>{
  const o={...d,leaderId,profiles:[leaderId,...d.memberIds].map(id=>latestProfiles.get(id))};
  const f=features(o),newRaw=f.S*supportOnlyK;
  const range=vertices=>{const values=vertices.map(([s,r])=>s*f.S+r*f.R);return {min:Math.min(...values),max:Math.max(...values)};};
  return {...o,features:f,predictions:{active:f.activeDisplay,oldSingle:{raw:f.oldSingleRaw,ceil:round1(f.oldSingleRaw)},
    oldTwo:{raw:f.oldTwoRaw,ceil:round1(f.oldTwoRaw)},newScaledSupport:{raw:newRaw,ceil:round1(newRaw)},
    newTwoCoefficientRawRange:range(regions[0].vertices),newNonnegativeTwoCoefficientRawRange:range(positiveRegion.vertices)},
    cautions:['Active profiles and parameter effects also change, and are checked separately. All score-support passives and leader score-support stay zero.',
      d.sampleId==='S'?'Ayame Pure >= 2 Active condition is OFF; this is deliberately evaluated at base 50%.':'General Flare 11/0. Combo >= 40 and Raden life >= 600 are assumed met.']};
 });
 assert.equal(next[0].features.rateSPCount,1);assert.equal(next[1].features.rateSPCount,3);
 assert.deepEqual(sourceLock(),sources);
 return {recordedAt:new Date().toISOString(),scope:'Retrospective baseline diagnosis using G/O/P/Q/R, board excluded. New coefficient ranges are fitted hypotheses, not prior prediction successes or exact game formulas.',
  definition:{S:'SP support marginal including rate/support interaction, duration-weighted /200',R:'Probability-only marginal, duration-weighted /200'},
  rows,regions,positiveRegion,
  newScaledSupport:{coefficientBounds:supportOnlyBounds,illustrativeMidpoint:supportOnlyK,checks:supportOnlyChecks,
    note:'S already includes activation-rate interaction. Omitting an additional R term does not mean activation-rate boosts have no SP effect. Every calibration formation has two 40% rate SPs, so identification remains limited.'},
  QR:{active:q.A,observedDelta:delta(r.observed,q.observed),deltaS:r.S-q.S,deltaR:r.R-q.R,
    supportDurationProducts:[12*100,14*95],deltaSupportDuration:130,
    supportCoefficientClosedInterval:[.7/(r.S-q.S),.9/(r.S-q.S)],
    interpretation:'Consistent with duration-weighted support under the assumed model. Not proof of separate duration/support laws or immunity to parameter-outfit changes.'},
  nextExperiments:next,sourceHashes:sources,coefficientSource,
  history:'Original predictions and coefficient file are unchanged. Proposed S/T predictions are based on these five observations and must be tested on new measurements.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(probeBaselineSP(),null,2));
