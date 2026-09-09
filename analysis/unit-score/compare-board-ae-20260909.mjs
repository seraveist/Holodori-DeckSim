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
import {boardPassiveFeatures} from './probe-passive-board-aa-20260909.mjs';
import {boardDisplayCandidates} from './compare-board-ac-20260909.mjs';
import {compareADAndPlanAE} from './compare-board-ad-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(9));
const cards=read('data/generated/cards.json'),characters=new Map(read('data/generated/characters.json').map(c=>[c.id,c])),masterRefs=read('data/generated/master_refs.json');
const boardEvidence=read('analysis/unit-score/board-context.json');
const ayameEvidence=read('analysis/unit-score/board-observations/AA-member-clarification-20260909.json');

export function numericBoardResearch(o){
 const prepared=prepareScoreCards(cards,characters,Object.fromEntries((o.profiles??fixture.profiles).map(p=>[p.id,p])),{masterRefs,levelMode:'current'});
 const leader=prepared.get(o.leaderId),members=o.memberIds.map(id=>prepared.get(id)),c=prepareDeckComposition({leader,members});
 if(c.leaderEffects.support!==0)return {id:o.sampleId,excluded:true,reason:'Score-support costume needs a separate model.'};
 const leaderBoardSupport=leader.characterId==='chr-06003'?clean(boardEvidence.leader.scoreSupportNodesPct.reduce((s,v)=>s+v,0)):
  ['chr-00018','chr-06002'].includes(leader.characterId)?0:null;
 if(leaderBoardSupport===null)return {id:o.sampleId,excluded:true,reason:'Leader board context is outside the confirmed scope of this probe.'};
 const boardMap=new Map(boards);boardMap.set(ayameEvidence.ayame.characterId,{rate:ayameEvidence.ayame.unconditionalActivationRateUpPct,cooldown:ayameEvidence.ayame.unconditionalCooldownShortenPct});
 const missing=members.filter(m=>!boardMap.has(m.characterId));if(missing.length)return {id:o.sampleId,excluded:true,reason:'Missing member timing/rate board inputs.',missing:missing.map(m=>m.characterId)};
 const support=members.map(m=>c.passive.supportByMember[m.id]),team={members,support};
 const inputs=members.map((m,i)=>({id:m.id,characterId:m.characterId,support:support[i],board:boardMap.get(m.characterId)}));
 const adjusted={...team,members:members.map(m=>{const b=boardMap.get(m.characterId);return {...m,active:{...m.active,
  probability:Math.min(1,m.active.probability*(1+b.rate/100)),interval:m.active.interval/(1+b.cooldown/100)}};})};
 const Araw=integrate(team),A=round1(Araw);
 // kernel's outfit argument is a numeric support multiplier here; this value comes from LEADER BOARD evidence, not an outfit.
 const Braw=integrate(adjusted,{outfit:leaderBoardSupport}),BPraw=integrate(adjusted,{outfit:leaderBoardSupport,passive:true});
 const Bdisplay=round1(Braw),BPdisplay=round1(BPraw),boardReference=clean(Bdisplay-A),passiveMarginalReference=clean(BPdisplay-Bdisplay);
 const observed=o.game?.scoreBonusDetail??{},observedBoard=observed.board??null,observedPassive=observed.passive??null;
 const reportedSum=observedBoard===null||observedPassive===null?null:clean(observedBoard+observedPassive);
 const rawCombined=BPraw-Araw,singleCeil=round1(rawCombined),twoCeilPossibleSums=[singleCeil,clean(singleCeil+.1)];
 return {id:o.sampleId,excluded:false,leaderId:o.leaderId,leaderCharacterId:leader.characterId,leaderBoardSupport,inputs,
  support,hasScoreSupportPassive:support.some(x=>x>0),Araw,A,Braw,BPraw,Bdisplay,BPdisplay,boardReference,passiveMarginalReference,
  observedBoard,observedPassive,boardMatches:observedBoard===null?null:boardReference===observedBoard,
  boardResidual:observedBoard===null?null:clean(observedBoard-boardReference),
  joint:{rawCombined,singleCeil,twoCeilPossibleSums,reportedSum,compatible:reportedSum===null?null:twoCeilPossibleSums.includes(reportedSum)},
  scope:'Numeric rate/frequency boards plus Ririka unconditional support13.3 when applicable. Singer effects excluded in the planned pre-song context. No numeric judgement contribution is added; the judgement node effect on formation display remains unproven.'};
}

export function compareAEAndPlanAF(){
 const checkpoint='analysis/unit-score/experiments/baseline-board-AE-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 for(const [p,h] of Object.entries({...plan.newEvidenceHashes,...plan.observationHashes,...plan.previousSourceLocks}))assert.equal(hash(p),h);
 assert.equal(hash('analysis/unit-score/compare-board-ad-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-board-AD-20260909.json'),plan.ADCheckpointSHA256);
 const previous=compareADAndPlanAE(),ae=read('analysis/unit-score/observations/AE-20260909.json');
 assert.equal(ae.predictionCheckpointSHA256,checkpointHash);assert.deepEqual(ae.memberIds,plan.memberIds);assert.equal(ae.leaderId,plan.leaderId);assert.deepEqual(ae.profiles,plan.profiles);
 const f=displayedActiveFeatures(ae),sp=quantizedSupportSP(f),rows=[...previous.rows,{...f,quantized:sp}];
 assert.equal(rows.length,29);assert.equal(new Set(rows.map(r=>r.id)).size,29);assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 const distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;assert.equal(distinctMemberSets,19);
 assert.equal(ae.game.overallPower,null);assert.equal(ae.game.scoreBonusPct,null);assert.equal(ae.game.scoreBonusDetail.passive,null);assert.equal(ae.scoreRowPresence.passive,false);
 const normalized=structuredClone(ae);normalized.game.scoreBonusDetail.passive=0;
 const b=boardPassiveFeatures(normalized),d=boardDisplayCandidates(f,b);
 const comparisons=[
  {item:'memberParameter',kind:'calculated',predicted:plan.features.power.memberParameter,observed:ae.game.powerDetail.memberParameter},
  {item:'passivePower',kind:'calculated',predicted:plan.features.power.passive,observed:ae.game.powerDetail.passive},
  {item:'active',kind:'existing board-excluded formula',predicted:plan.features.A,observed:ae.game.scoreBonusDetail.active},
  {item:'special',kind:'existing board-excluded formula',predicted:plan.quantized.display,observed:ae.game.scoreBonusDetail.special},
  ...plan.hypotheses.board.candidates.map(c=>({item:'boardScore',kind:c.rule,predicted:c.display,observed:ae.game.scoreBonusDetail.board}))
 ].map(c=>({...c,matches:c.predicted===c.observed,delta:clean(c.observed-c.predicted)}));
 assert.ok(comparisons.slice(0,4).every(c=>c.matches));assert.equal(comparisons[4].matches,false);assert.equal(comparisons[5].matches,true);
 const controls=[...previous.controls,{id:'AE',observed:ae.game.scoreBonusDetail.board,display:d}];
 const survivorRules=['rawIncrementCeil','rawIncrementRound','rawIncrementFloor','differenceOfCeilDisplays'].filter(rule=>controls.every(c=>c.display[rule]===c.observed));
 assert.deepEqual(survivorRules,['differenceOfCeilDisplays']);
 const categorySum=clean(Object.values(ae.game.scoreBonusDetail).filter(v=>v!==null).reduce((s,v)=>s+v,0));assert.equal(categorySum,119.5);
 const observations=[...fixture.observations,...['M','O','P','Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE'].map(id=>read(`analysis/unit-score/observations/${id}-20260909${id==='Z'?'-completed':''}.json`))];
 const extensionRows=observations.map(numericBoardResearch),eligible=extensionRows.filter(r=>!r.excluded);
 const zeroPassive=eligible.filter(r=>!r.hasScoreSupportPassive),positivePassive=eligible.filter(r=>r.hasScoreSupportPassive);
 assert.equal(zeroPassive.length,11);assert.equal(zeroPassive.filter(r=>r.boardMatches).length,10);assert.deepEqual(zeroPassive.filter(r=>!r.boardMatches).map(r=>r.id),['G']);
 assert.equal(positivePassive.length,14);assert.ok(positivePassive.every(r=>!r.boardMatches));assert.ok(positivePassive.every(r=>r.joint.compatible));
 const r=zeroPassive.find(r=>r.id==='R'),er=zeroPassive.find(r=>r.id==='AE');assert.equal(clean(r.observedBoard-er.observedBoard),10.4);
 const baseAC=read('analysis/unit-score/observations/AC-20260909.json'),nextIds=baseAC.memberIds.map(id=>id==='card-00021-5-uniq-0017-00'?'card-00021-5-uniq-0064-00':id);
 const nextObservation={sampleId:'AF',leaderId:baseAC.leaderId,memberIds:nextIds,
  profiles:[baseAC.leaderId,...nextIds].map(id=>({... (baseAC.profiles.find(p=>p.id===id)??fixture.profiles.find(p=>p.id===id))}))};
 const nf=displayedActiveFeatures(nextObservation),nsp=quantizedSupportSP(nf),nb=numericBoardResearch(nextObservation);
 assert.equal(nf.power.memberParameter,102771);assert.equal(nf.power.passive,16443);assert.equal(nf.power.outfit,0);assert.equal(nf.retainedPower,119214);
 assert.equal(nf.A,71.8);assert.equal(nsp.display,42.6);assert.deepEqual(nf.conditions.passiveSupport,[0,0,8,8,0]);
 assert.equal(nf.conditions.leaderScoreSupport,0);assert.equal(nf.conditions.leaderParameterConditionMet,false);
 const timingInputs=x=>x.inputs.map(i=>({characterId:i.characterId,...i.board})).sort((a,b)=>a.characterId.localeCompare(b.characterId));
 assert.deepEqual(timingInputs(nb),timingInputs(numericBoardResearch(baseAC)));
 const prepared=prepareScoreCards(cards,characters,Object.fromEntries(nextObservation.profiles.map(p=>[p.id,p])),{masterRefs,levelMode:'current'});
 assert.equal(nextIds.filter(id=>prepared.get(id).attribute===3).length,2);
 assert.equal(nb.boardReference,.6);assert.equal(nb.passiveMarginalReference,2.6);assert.deepEqual(nb.joint.twoCeilPossibleSums,[3.3,3.4]);
 assert.ok(!rows.some(r=>[...r.memberIds].sort().join(',')===[...nextIds].sort().join(',')));
 assert.equal(hash(checkpoint),checkpointHash);assert.deepEqual(sourceLock(),plan.sourceHashes);
 return {schemaVersion:1,recordedAt:new Date().toISOString(),scope:'AE selects the board display-difference candidate in zero-support-passive Suisei controls; retrospective leader/passive extension audit and same-character passive-source AF plan. No production change.',
  observation:ae,comparisons,passiveComparison:{predicted:0,observedNumeric:null,observedRowPresent:false,normalizedDisplayedContribution:0,matches:true},
  arithmetic:{reportedOverallPower:null,memberPlusPassive:104183,reportedScoreBonus:null,sumOfConfirmedBonusRows:categorySum,status:'Power subtotal104183 and bonus sum119.5 are derived; overall totals remain unreported.'},
  controls,survivorRules,boardFeatures:b,displayCandidates:d,
  selectedBoardCandidate:{formula:'Board = ceil0.1(board-adjusted Active raw) - ceil0.1(base Active raw)',
   rawModel:'200-second weighted kernel; board probability multiplies base probability by1+rate/100, interval divides by1+frequency/100 without interval rounding.',
   scope:'Selected among four tested display rules for zero-score-support-passive Suisei leader controls AC/AD/AE. Not a proof of every game rule or positive-passive allocation.',
   evidence:{retrospectiveAtSelection:['AC'],independentDiscriminatingChecks:['AD','AE'],earlierFailedRulesRemainRejected:true}},
  extensionAudit:{rows:extensionRows,zeroPassive:{rows:zeroPassive,matches:10,total:11,failures:['G'],
    ririka:'Support13.3 extension retrospectively matches O/P/Q/R/S/T/V. G predicts13.7 versus13.8 and remains unresolved.',
    pairedRminusAE:{board:10.4,active:0,special:0,meaning:'Same five members, different leaders. Extra displayed board contribution is10.4 for this pair; do not make it a universal correction.'}},
   positivePassive:{rows:positivePassive,individualBoardMatches:0,total:14,
    conclusion:'Simple cumulative marginal board/passive allocation fails. The separate-ceil joint raw-sum compatibility family covers these rows retrospectively, but does not compute individual categories.'},
   limitations:['Leader-support extension is new post-AE retrospective work, not seven independent forecast successes.',
    'Ririka judgement-node numeric contribution is not modeled; matches do not prove it is inactive or irrelevant. Singer effect remains conditional and excluded in the planned pre-song context.',
    'Ayame score-support costumes and unsupported leader/member board contexts are explicitly excluded from this extension, not treated as zero.']},
  summary:{observations:29,distinctMemberSets,activeMatches:29,refinedSPMatches:29,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberChecks:['W','AA','AB','AC','AD'],sameMemberLeaderChecks:['X','Y','Z','AE'],AEReference:'R'},
   passiveStatus:'General passive formula and Ayame score-support outfit remain unresolved.'},rows,
  next:{...nextObservation,features:nf,quantized:nsp,numericBoardFeatures:nb,
   controlReference:'AC',changeFromAC:'Replace regular Flare11/0 with swimsuit Flare80/1, keeping Suisei leader and the four other cards.',
   changeFromCurrentAE:'Replace swimsuit Noel80/1 with swimsuit Flare80/1 and swimsuit Kanade40/0 with regular Kanade80/0.',
   purpose:'Return to positive passive validation with unchanged member character-board inputs relative to AC, and exactly two Happy recipients of Flare support8: Raden and Flare.',
   fixedBoardInputs:timingInputs(nb),
   hypotheses:{active:{display:nf.A,kind:'Existing board-excluded formula'},special:{display:nsp.display,kind:'Existing board-excluded formula'},
    board:{display:null,kind:'No positive-passive allocation formula'},passive:{display:null,kind:'Positive support exists but the individual displayed amount remains unpredicted'},
    conditionalJoint:{possibleDisplays:[3.3,3.4],raw:nb.joint.rawCombined,kind:'Compatibility family only, conditional on the unproven combined raw model and separate ceil0.1 of the two categories. Not an individual-category prediction.'}},
   diagnosticOnly:{boardReferenceWithoutSupport:.6,cumulativeMarginalPassiveReference:2.6,status:'The corresponding simple split fails prior positive-passive rows; these are diagnostic references, not adopted predictions.'},
   assumptions:'Same pre-song view; no related Suisei leader boards, inactive outfit, Ayame singer effect excluded. Regular Kanade100combo and Raden life600 treated as met; Flare Happy2 condition is met. Keep existing growth and board unlocks.',
   limitations:'Relative to AC, the Flare card changes Active/SP/stats/power-passives as well as adding score-support passive, all recorded separately. Holding character-board inputs fixed does not hold every skill constant. A compatible joint sum will not establish a unique passive formula.',
   requestedMeasurements:'Member parameter, passive power, Active, SP, board and passive score separately. Total score bonus if available.'},
  provenance:{AECheckpointSHA256:checkpointHash,AEObservationSHA256:hash('analysis/unit-score/observations/AE-20260909.json'),sourceHashes:sourceLock(),
   newEvidenceHashes:plan.newEvidenceHashes,previousObservationHashes:plan.observationHashes,
   previousSourceLocks:{...plan.previousSourceLocks,'analysis/unit-score/compare-board-ad-20260909.mjs':plan.analysisSourceSHA256},predictionsAndProductionUnchanged:true}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareAEAndPlanAF(),null,2));
