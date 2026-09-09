import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {prepareScoreCards} from '../../js/card-prepare.js';
import {prepareDeckComposition,evaluateDeck} from '../../js/score.js';
import {integrate,condition,round1} from './dummy-model-lab.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const fixture=read('scripts/fixtures/unit-observations-20260908.json');
const cards=read('data/generated/cards.json');
const characters=new Map(read('data/generated/characters.json').map(c=>[c.id,c]));
const masterRefs=read('data/generated/master_refs.json');

export function displayedActiveFeatures(o){
 const profiles=o.profiles??fixture.profiles;
 const prepared=prepareScoreCards(cards,characters,Object.fromEntries(profiles.map(p=>[p.id,p])),{masterRefs,levelMode:'current'});
 const leader=prepared.get(o.leaderId),members=o.memberIds.map(id=>prepared.get(id));
 const c=prepareDeckComposition({leader,members});
 const team={members,support:members.map(m=>c.passive.supportByMember[m.id])};
 const Araw=integrate(team,{board:false}),A=round1(Araw);
 const SP=members.map(m=>({id:m.id,name:m.characterName,duration:m.special.duration,support:m.special.support,
   rate:condition(m.special.condition,team)?m.special.activationRateUp:0,condition:m.special.condition,
   conditionMet:condition(m.special.condition,team)}));
 const W=SP.reduce((s,m)=>s+m.duration*m.support,0),rateSum=SP.reduce((s,m)=>s+m.rate,0);
 const rateDurationSum=SP.reduce((s,m)=>s+m.duration*m.rate,0);
 const raw=A*(W/12000+rateSum/2000);
 const durationRaw=A*(W/12000+rateDurationSum/20000);
 const engine=evaluateDeck({leader,members});
 return {id:o.sampleId,memberIds:o.memberIds,Araw,A,W,rateSum,rateDurationSum,SP,
   observedActive:o.game?.scoreBonusDetail.active??null,observedSP:o.game?.scoreBonusDetail.special??null,
   displayedActiveFlatRate:{raw,ceil:round1(raw)},displayedActiveDurationRate:{raw:durationRaw,ceil:round1(durationRaw)},
   rawActiveFlatRate:{raw:Araw*(W/12000+rateSum/2000),ceil:round1(Araw*(W/12000+rateSum/2000))},
   power:engine.detail.power,retainedPower:engine.overallPower,
   conditions:{leaderScoreSupport:c.leaderEffects.support,leaderParameterConditionMet:c.primaryMet,passiveSupport:team.support,
    active:members.map(m=>({id:m.id,condition:m.active.condition,conditionMet:condition(m.active.condition,team),
      effectiveValue:condition(m.active.condition,team)?m.active.conditionalScoreUp:m.active.baseScoreUp}))}};
}

export function probeDisplayedActiveSP(){
 const sources=sourceLock();
 const observations=[...fixture.observations,...['M','O','P','Q','R','S','T','U'].map(id=>read(`analysis/unit-score/observations/${id}-20260909.json`))];
 const rows=observations.map(displayedActiveFeatures);
 assert.ok(rows.every(r=>r.A===r.observedActive));
 const baselineIds=['G','O','P','Q','R','S','T','U'],base=rows.filter(r=>baselineIds.includes(r.id));
 assert.ok(base.every(r=>r.conditions.leaderScoreSupport===0&&r.conditions.passiveSupport.every(n=>n===0)));
 const variants=[];
 for(const activeInput of ['raw','ceil0.1'])for(const rateWeighting of ['sum','duration'])for(const rounding of ['ceil','round','floor']){
  const results=rows.map(r=>{const A=activeInput==='raw'?r.Araw:r.A;
   const raw=A*(r.W/12000+(rateWeighting==='sum'?r.rateSum/2000:r.rateDurationSum/20000));
   return {id:r.id,raw,display:round1(raw,rounding),observed:r.observedSP,matches:round1(raw,rounding)===r.observedSP};});
  variants.push({activeInput,rateWeighting,rounding,matches:results.filter(r=>r.matches).length,
   baselineMatches:results.filter(r=>r.matches&&baselineIds.includes(r.id)).length,results});
 }
 const preferred=variants.find(v=>v.activeInput==='ceil0.1'&&v.rateWeighting==='sum'&&v.rounding==='ceil');
 assert.equal(preferred.baselineMatches,8);assert.equal(preferred.matches,17);
 assert.deepEqual(preferred.results.filter(r=>!r.matches).map(r=>r.id),['C','M']);
 const checkpoint=read('analysis/unit-score/experiments/baseline-sp-U-20260909.json');
 const u=rows.find(r=>r.id==='U'),uo=observations.find(o=>o.sampleId==='U');
 for(const key of ['memberParameter','outfit','passive'])assert.equal(u.power[key],uo.game.powerDetail[key]);
 assert.equal(checkpoint.specialHypotheses.durationWeightedFamily.diagnosticD120.ceil,uo.game.scoreBonusDetail.special);
 const numerator=u.Araw*u.W/100;
 const profileIds=['card-06003-5-uniq-0059-00','card-00010-5-uniq-0010-00','card-00018-5-uniq-0068-00','card-00027-5-uniq-0022-00','card-06004-5-uniq-0060-00','card-06002-5-uniq-0058-00'];
 const nextObservation={sampleId:'V',leaderId:profileIds[0],memberIds:profileIds.slice(1),
  profiles:profileIds.map(id=>fixture.profiles.find(p=>p.id===id))};
 const next=displayedActiveFeatures(nextObservation);
 assert.equal(next.conditions.leaderScoreSupport,0);assert.ok(next.conditions.passiveSupport.every(x=>x===0));
 assert.equal(next.rateSum,125);
 assert.deepEqual(sourceLock(),sources);
 return {recordedAt:new Date().toISOString(),scope:'After-U retrospective candidate search. Coefficients 12000/2000 and use of a rounded Active input define a new aggregate model, not the previously rejected whole-window marginal features.',
   formula:'B_SP = ceil0.1(ceil0.1(A_raw) * [sum_i(duration_i * supportPct_i)/12000 + sum_i(effectiveRatePct_i)/2000])',
   units:'Use displayed percent numbers, e.g. support 135 and rate 40. Apply member-only conditions and exclude boards. No fitted per-card constants.',
   rows,variants,preferredSummary:{observations:19,matches:preferred.matches,baselineObservations:8,baselineMatches:8,
    distinctMemberSets:new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size,
    failures:preferred.results.filter(r=>!r.matches),
    history:'The complete formula was found after observing U; matching previous rows is retrospective, not 17 fresh prediction successes.'},
   U:{retainedPower:u.retainedPower,reportedPower:uo.game.overallPower,excludedPowerAggregate:uo.game.overallPower-u.retainedPower,
    active:u.A,observedSpecial:u.observedSP,frozenD120:checkpoint.specialHypotheses.durationWeightedFamily.diagnosticD120,
    frozenD200:checkpoint.specialHypotheses.durationWeightedFamily.diagnosticD200,
    rawActiveDenominatorIntervalAssumingCeil:{inclusiveMin:numerator/u.observedSP,exclusiveMax:numerator/(u.observedSP-.1)},
    precisionNote:'U alone cannot distinguish raw vs rounded Active inputs: both D=120 variants display 31.8. G/P/T discriminate them within the proposed formula family.',
    missingBonusCategorySum:Math.round((uo.game.scoreBonusPct-u.A-u.observedSP)*1e9)/1e9},
   next:{...nextObservation,features:next,
    purpose:'A new zero-score-support-passive formation introduces a 45% rate SP alongside two 40% rate SPs, testing the new formula beyond the 0/40% rates of the eight baseline measurements.',
    assumptions:'Regular Kanade SP combo >=100 and Raden life >=600 are assumed met. No board corrections.',
    validationLimit:'Active profiles also change and are evaluated separately. All positive-rate SPs still last 10s, so this cannot distinguish flat from duration-weighted rate contributions. One match does not prove the general formula.'},
   sourceHashes:sources,
   limitations:['Effective positive rates in the eight baseline measurements are all 40% with duration 10s; flat and duration-weighted rate models are indistinguishable on those rows.',
    'C and M predict 46.0 but observe 46.1. Their discrepancy is not assigned to passive/leader outfit without further evidence.',
    'Constants 120 and 2000 are candidate normalization factors, not proof of internal song duration or physical SP frequency.']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(probeDisplayedActiveSP(),null,2));
