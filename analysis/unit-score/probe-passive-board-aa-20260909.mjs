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
import {compareAA} from './compare-passive-aa-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(9));
const evidencePath='analysis/unit-score/board-observations/AA-member-clarification-20260909.json';
const cards=read('data/generated/cards.json'),characters=new Map(read('data/generated/characters.json').map(c=>[c.id,c]));
const masterRefs=read('data/generated/master_refs.json');

export function boardPassiveFeatures(o,{probabilityBoost='relative',cooldownMode='divide',cooldownRounding='raw'}={}){
 const evidence=read(evidencePath),boardMap=new Map(boards);
 assert.equal(evidence.ayame.userSaysOnlySingerConditionalNodes,true);
 boardMap.set(evidence.ayame.characterId,{rate:evidence.ayame.unconditionalActivationRateUpPct,cooldown:evidence.ayame.unconditionalCooldownShortenPct});
 const prepared=prepareScoreCards(cards,characters,Object.fromEntries(o.profiles.map(p=>[p.id,p])),{masterRefs,levelMode:'current'});
 const members=o.memberIds.map(id=>prepared.get(id)),composition=prepareDeckComposition({leader:prepared.get(o.leaderId),members});
 assert.equal(composition.leaderEffects.support,0);assert.equal(composition.primaryMet,false);
 assert.equal(o.leaderId,'card-00018-5-uniq-0068-00');
 const team={members,support:members.map(m=>composition.passive.supportByMember[m.id])};
 const inputs=members.map((m,i)=>({id:m.id,characterId:m.characterId,support:team.support[i],board:boardMap.get(m.characterId)??null}));
 const boardTeam={...team,members:members.map(m=>{
  const b=boardMap.get(m.characterId);assert.ok(b,`Missing member-board timing inputs for ${m.characterId}`);
  let interval=cooldownMode==='multiply'?m.active.interval*(1-b.cooldown/100):m.active.interval/(1+b.cooldown/100);
  if(cooldownRounding!=='raw')interval=Math[cooldownRounding](interval);
  const probability=Math.min(1,probabilityBoost==='relative'?m.active.probability*(1+b.rate/100):m.active.probability+b.rate/100);
  return {...m,active:{...m.active,interval,probability}};
 })};
 const base=integrate(team),passiveOnly=integrate(team,{passive:true}),boardOnly=integrate(boardTeam),both=integrate(boardTeam,{passive:true});
 const observedBoard=o.game?.scoreBonusDetail.board??null,observedPassive=o.game?.scoreBonusDetail.passive??null;
 const observedSum=observedBoard===null||observedPassive===null?null:clean(observedBoard+observedPassive);
 return {id:o.sampleId,inputs,base,passiveOnly,boardOnly,both,
  raw:{boardBeforePassive:boardOnly-base,passiveAfterBoard:both-boardOnly,passiveBeforeBoard:passiveOnly-base,boardAfterPassive:both-passiveOnly,combined:both-base},
  display:{boardBeforePassive:round1(boardOnly-base),passiveAfterBoard:round1(both-boardOnly),passiveBeforeBoard:round1(passiveOnly-base),boardAfterPassive:round1(both-passiveOnly),combined:round1(both-base)},
  observed:{board:observedBoard,passive:observedPassive,sum:observedSum},
  combinedMatches:observedSum===null?null:round1(both-base)===observedSum,
  effectiveActive:boardTeam.members.map(m=>({id:m.id,interval:m.active.interval,probability:m.active.probability}))};
}

export function probeBoardAfterAA(){
 const comparison=compareAA(),sourceHashes=sourceLock();
 const observations=[read('analysis/unit-score/observations/Z-20260909-completed.json'),read('analysis/unit-score/observations/AA-20260909.json')];
 const variants=[];
 for(const probabilityBoost of ['relative','absolute'])for(const cooldownMode of ['multiply','divide'])for(const cooldownRounding of ['raw','floor','round','ceil']){
  const config={probabilityBoost,cooldownMode,cooldownRounding},rows=observations.map(o=>boardPassiveFeatures(o,config));
  variants.push({config,rows,combinedMatches:rows.filter(r=>r.combinedMatches).length,
   individualMatches:rows.filter(r=>r.display.boardBeforePassive===r.observed.board&&r.display.passiveAfterBoard===r.observed.passive).length});
 }
 assert.equal(variants.length,16);assert.ok(variants.every(v=>v.individualMatches===0));
 const preferred=variants.find(v=>v.config.probabilityBoost==='relative'&&v.config.cooldownMode==='divide'&&v.config.cooldownRounding==='raw');
 assert.equal(preferred.combinedMatches,2);assert.equal(variants.filter(v=>v.combinedMatches===2).length,1);
 const aa=observations[1],nextMemberIds=aa.memberIds.map(id=>id==='card-06002-5-uniq-0058-00'?'card-00021-5-uniq-0017-00':id);
 const nextObservation={sampleId:'AB',leaderId:aa.leaderId,memberIds:nextMemberIds,
  profiles:[aa.leaderId,...nextMemberIds].map(id=>id==='card-00021-5-uniq-0017-00'?{id,level:11,potential:0}:{...fixture.profiles.find(p=>p.id===id)})};
 const features=displayedActiveFeatures(nextObservation),quantized=quantizedSupportSP(features),joint=boardPassiveFeatures(nextObservation,preferred.config);
 const alternatives=variants.map(v=>({config:v.config,combinedDisplay:boardPassiveFeatures(nextObservation,v.config).display.combined}));
 assert.equal(features.A,73.7);assert.equal(quantized.display,43.6);assert.equal(features.power.memberParameter,84026);
 assert.equal(features.power.passive,13617);assert.equal(features.retainedPower,97643);assert.equal(features.power.outfit,0);
 assert.equal(joint.display.combined,7.4);
 assert.deepEqual(features.conditions.passiveSupport,comparison.rows.find(r=>r.id==='AA').conditions.passiveSupport);
 assert.deepEqual(joint.inputs.filter(i=>i.support>0).map(i=>i.id),['card-06004-5-uniq-0060-00','card-00026-5-uniq-0065-00']);
 assert.deepEqual(sourceLock(),sourceHashes);
 return {schemaVersion:1,recordedAt:new Date().toISOString(),scope:'Post-AA exploratory model selection for the SUM of board and passive categories, plus a frozen new-member AB test. No individual passive formula is established.',
  evidence:{path:evidencePath,SHA256:hash(evidencePath),interpretation:'Ayame only has singer-conditional nodes. Exclude them under the planned pre-song-selection context. Noel/Kanade existing timing/rate inputs are unchanged. Conditional node values remain unknown.'},
  formula:{base:'Unmodified 200-second weighted Active raw.',
   adjustedProbability:'min(1, baseProbability * (1 + memberBoardRatePct/100))',
   adjustedInterval:'baseInterval / (1 + memberBoardFrequencyPct/100), without rounding the interval',
   passiveSupport:'Multiply each recipient Active score-up value by (1 + passiveSupportPct/100).',
   combined:'ceil0.1(integrate(board-adjusted Active with passive support) - integrate(base Active))',
   limitations:'This compares a one-rounded modeled increment with the sum of two separately displayed categories. It does not determine their internal rounding or allocation, nor prove the internal 200-second duration.'},
  variants,preferred,
  interpretation:{retrospective:true,samplesAtDiscovery:2,distinctMemberSets:2,independentPredictionSuccesses:0,
   conclusion:'The relative-probability, frequency-divisor, unrounded-interval candidate is the sole tested variant matching combined Z 8.4 and AA 4.1. Both individual category predictions remain wrong.',
   individualFailure:'Marginal board/passive attribution predicts Z 5.5/3.0 and AA 1.3/2.8 rather than measured 6.9/1.5 and 3.3/0.8.',
   caution:'Matching a total cannot validate a category split. Many untested formulas may also fit two observations. Do not infer a board-to-passive multiplier or transfer a per-case residual.'},
  next:{...nextObservation,features,quantized,joint,alternatives,
   change:'From AA keep Suisei leader and Ayame, Towa, Raden, swimsuit Watame; replace regular Kanade 80/0 with regular Flare 11/0.',
   purpose:'A third composition tests the combined candidate without fitting to its measurement. Exactly the same two Happy support recipients remain.',
   hypotheses:{active:{display:features.A,kind:'Existing research formula'},special:{display:quantized.display,kind:'Existing research formula'},
    boardPlusPassive:{display:joint.display.combined,kind:'New post-AA combined candidate; zero independent successes before AB'},
    passive:{display:null,kind:'No individual formula'},board:{display:null,kind:'No individual formula'}},
   assumptions:'Same pre-song view; Ayame singer effect excluded; Flare combo >=40 and Raden life >=600 treated as met. General Flare 11/0 was confirmed in P. Flare recorded member board rate6/cooldown0 carries forward. No changes to growth or board unlocks.',
   limitations:'Several skills and member boards change, so a match validates only the combined prediction for another composition. It does not identify the cause of the Z-to-AA passive change or distinguish every timing rule.',
   requestedMeasurements:'Active, SP, passive score and board score separately; member parameter and passive power for formation verification. Total score bonus if available; preserve omitted rows as unreported.'},
  sourceHashes,newEvidenceHashes:{...comparison.provenance.newEvidenceHashes,[evidencePath]:hash(evidencePath)},
  observationHashes:Object.fromEntries(['Z-20260909-completed','AA-20260909'].map(id=>{const p=`analysis/unit-score/observations/${id}.json`;return [p,hash(p)];})),
  AAComparisonSourceSHA256:hash('analysis/unit-score/compare-passive-aa-20260909.mjs'),AACheckpointSHA256:comparison.provenance.AACheckpointSHA256};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(probeBoardAfterAA(),null,2));
