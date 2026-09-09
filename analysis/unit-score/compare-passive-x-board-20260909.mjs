import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {fixture,prepared} from './validation-data.mjs';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(9));

export function compareXAndPlanY(){
 const checkpoint='analysis/unit-score/experiments/baseline-passive-X-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 assert.equal(hash('analysis/unit-score/compare-sp-w-passive-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-sp-W-20260909.json'),plan.WCheckpointSHA256);
 const boardPath='analysis/unit-score/board-observations/WX-clarification-20260909.json';
 const board=read(boardPath),ririka=read(board.evidence.ririkaReconfirmation);
 assert.equal(hash(board.evidence.ririkaReconfirmation),board.evidence.ririkaRecordSHA256);
 assert.equal(board.view.beforeSongSelection,true);
 assert.equal(board.leaders.X.relevantLeaderBoardEffectsAbsentConfirmed,true);
 assert.deepEqual([...read('analysis/unit-score/board-context.json').leader.scoreSupportNodesPct].sort((a,b)=>a-b),[...board.leaders.W.scoreSupportNodesPct].sort((a,b)=>a-b));
 assert.equal(clean(board.leaders.W.scoreSupportNodesPct.reduce((s,x)=>s+x,0)),13.3);
 const observations=[...fixture.observations,...['M','O','P','Q','R','S','T','U','V','W','X'].map(id=>read(`analysis/unit-score/observations/${id}-20260909.json`))];
 const rows=observations.map(o=>{const f=displayedActiveFeatures(o);return {...f,quantized:quantizedSupportSP(f)};});
 const xo=observations.find(o=>o.sampleId==='X'),wo=observations.find(o=>o.sampleId==='W');
 const x=rows.find(r=>r.id==='X'),w=rows.find(r=>r.id==='W');
 assert.equal(xo.predictionCheckpointSHA256,checkpointHash);
 assert.deepEqual(xo.memberIds,plan.memberIds);assert.deepEqual(xo.profiles,plan.profiles);assert.equal(xo.leaderId,plan.leaderId);
 assert.equal(rows.length,22);assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 const distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;
 assert.equal(distinctMemberSets,15);
 const comparisons=['memberParameter','outfit','passive'].map(item=>({item,predicted:plan.features.power[item],observed:xo.game.powerDetail[item]}));
 comparisons.push({item:'retainedPower',predicted:plan.features.retainedPower,observed:xo.game.powerDetail.memberParameter+xo.game.powerDetail.outfit+xo.game.powerDetail.passive},
  {item:'active',predicted:plan.features.A,observed:xo.game.scoreBonusDetail.active},
  {item:'special',predicted:plan.quantized.display,observed:xo.game.scoreBonusDetail.special});
 for(const c of comparisons){c.matches=c.predicted===c.observed;assert.ok(c.matches);}
 const passiveComparison={hypothesis:plan.passiveHypothesis,predicted:plan.passiveHypothesis.display,
  observed:xo.game.scoreBonusDetail.passive,matches:plan.passiveHypothesis.display===xo.game.scoreBonusDetail.passive,
  errorPredictedMinusObserved:clean(plan.passiveHypothesis.display-xo.game.scoreBonusDetail.passive)};
 assert.equal(passiveComparison.matches,false);assert.equal(passiveComparison.errorPredictedMinusObserved,0.4);
 const knownBonusSum=clean(Object.values(xo.game.scoreBonusDetail).filter(v=>v!==null).reduce((s,v)=>s+v,0));
 assert.equal(knownBonusSum,xo.game.scoreBonusPct);
 const deltas=Object.fromEntries(['active','special','board','passive'].map(key=>[key,clean(xo.game.scoreBonusDetail[key]-wo.game.scoreBonusDetail[key])]));
 deltas.total=clean(xo.game.scoreBonusPct-wo.game.scoreBonusPct);
 deltas.afterSubtractingDisplayedBoard=clean((xo.game.scoreBonusPct-xo.game.scoreBonusDetail.board)-(wo.game.scoreBonusPct-wo.game.scoreBonusDetail.board));
 assert.deepEqual(deltas,{active:0,special:0,board:-10.4,passive:-0.4,total:-10.8,afterSubtractingDisplayedBoard:-0.4});
 assert.deepEqual(x.memberIds,w.memberIds);assert.deepEqual(x.conditions.passiveSupport,w.conditions.passiveSupport);
 const nextLeaderId='card-06002-5-uniq-0058-00';
 const nextObservation={sampleId:'Y',leaderId:nextLeaderId,memberIds:xo.memberIds,
  profiles:[nextLeaderId,...xo.memberIds].map(id=>({...fixture.profiles.find(p=>p.id===id)}))};
 const nf=displayedActiveFeatures(nextObservation),nsp=quantizedSupportSP(nf);
 const oldLeader=prepared.get(xo.leaderId),newLeader=prepared.get(nextLeaderId);
 assert.equal(oldLeader.characterId,newLeader.characterId);assert.equal(newLeader.characterId,board.leaders.X.characterId);
 assert.deepEqual(oldLeader.leader.primaryEffects,{p:130,t:0,s:0,support:0});
 assert.deepEqual(newLeader.leader.primaryEffects,{p:0,t:0,s:130,support:0});
 assert.equal(nf.conditions.leaderParameterConditionMet,true);assert.equal(nf.conditions.leaderScoreSupport,0);
 assert.deepEqual(nf.conditions.passiveSupport,x.conditions.passiveSupport);
 assert.equal(nf.power.memberParameter,x.power.memberParameter);assert.equal(nf.power.passive,x.power.passive);
 assert.equal(nf.A,x.observedActive);assert.equal(nsp.display,x.observedSP);
 assert.equal(hash(checkpoint),checkpointHash);assert.deepEqual(sourceLock(),plan.sourceHashes);
 return {recordedAt:new Date().toISOString(),scope:'X frozen-prediction comparison and W/X leader-board confounding audit, with a same-character costume control Y. Research only.',
  X:{observation:xo,comparisons,passiveComparison,retainedPower:x.retainedPower,excludedPowerAggregate:xo.game.overallPower-x.retainedPower,
   knownBonusSum,retainedBonus:clean(xo.game.scoreBonusPct-xo.game.scoreBonusDetail.board),historicalCheckpointSHA256:checkpointHash,
   predictionHistoryUnchanged:true},
  WX:{before:wo.game,after:xo.game,deltas,
   fixed:{memberIds:x.memberIds,memberProfiles:xo.profiles.filter(p=>p.id!==xo.leaderId),active:x.A,special:x.observedSP,
    passiveSupportByMember:x.conditions.passiveSupport},
   changed:{leaderCharacter:'Ririka -> Kanade',parameterOutfit:'Inactive -> all-member performance +130%',
    leaderBoard:'Ririka score support 13.3 plus judgement/conditional singer nodes -> Kanade relevant leader-board effects absent'},
   correction:'The earlier X plan described a parameter-only costume intervention but changed the leader character too. It did not control character-board effects. The 0.4 passive decrease must not be attributed uniquely to the costume.',
   conclusion:'The planned passive-invariance prediction failed. A leader-board interaction and a parameter-outfit interaction remain competing explanations; displayed board subtraction alone does not distinguish them.'},
  boardAudit:{context:board,ririkaRecord:ririka,
   historicalSupportReconfirmed:true,newlyDocumentedFields:['Judgement: 20 seconds, low probability, 7-second GOOD-or-better to PERFECT conversion','Conditional all-member singer support 24%'],
   baselineHandling:'Preserve board-excluded Active/SP formulas; use leader-board interactions as separately identified passive hypotheses. Do not silently modify past predictions or production calculations.',
   numericalLimits:['13.3 is the arithmetic sum of three node inputs, not a directly observed +13.3 pp bonus.',
    'The measured board-row difference is 10.4 pp; do not identify it directly with the 13.3% input.',
    'No song is selected. Do not apply the conditional 24% unconditionally or presume how a hidden preview evaluates singer conditions.',
    'Low probability is not a measured numeric probability. Judgement contribution cannot be computed exactly from the supplied phrase.']},
  summary:{observations:22,distinctMemberSets,activeMatches:22,refinedSPMatches:22,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberDiscriminatingMatch:'W',additionalSameMemberLeaderCheck:'X'},
   passive:'Unresolved; the X 1.9 invariance hypothesis is retained as a failed prediction.'},
  rows,
  next:{...nextObservation,features:nf,quantized:nsp,
   leaderDescription:newLeader.leader.description,
   change:'X: change leader from swimsuit Kanade 40/0 to regular Kanade 80/0. Keep the same five members, their growth, and the pre-song-selection formation view.',
   control:'Same Kanade character, user-confirmed absence of relevant leader-board effects. Both costumes are parameter-only; performance +130% changes to sense +130%.',
   assumptions:'Pure >=2 (Ayame and Towa) activates the regular Kanade costume. Leader member skills are excluded. Raden life >=600 stays assumed met. No board corrections added.',
   hypotheses:{passive:{display:1.5,status:'Unsolved-formula invariance hypothesis: fixed members and leader character, only parameter outfit stat changes.'},
    displayedBoard:{display:6.9,status:'Observed-X invariance hypothesis for unchanged character boards and member set, not a computed board formula.'}},
   interpretation:{samePassive:'Supports passive invariance under this performance-to-sense costume swap; raises the priority of leader-board/leader-character differences for W/X but does not prove them.',
    differentPassive:'Shows passive still changes in a same-character costume comparison with no relevant leader-board effects; examine parameter distribution or costume-dependent display attribution.'},
   limitations:'Both costumes still have a parameter effect. This does not by itself test zero parameter outfit versus nonzero, establish universal invariance, or prove that Ririka boards caused exactly +0.4.',
   requestedMeasurements:'Total power and member/outfit/passive power; total score bonus plus Active, SP, passive, board, and outfit score row or absence.'},
  sourceHashes:sourceLock(),newEvidenceHashes:{[boardPath]:hash(boardPath),[board.evidence.ririkaReconfirmation]:hash(board.evidence.ririkaReconfirmation)}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareXAndPlanY(),null,2));
