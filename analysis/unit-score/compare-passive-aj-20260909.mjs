import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {displayedActiveFeatures} from './probe-sp-displayed-active-20260909.mjs';
import {quantizedSupportSP} from './compare-sp-v-rounding-20260909.mjs';
import {numericBoardResearch} from './compare-board-ae-20260909.mjs';
import {compareAIAndPlanAJ} from './compare-passive-ai-20260909.mjs';
import {sourceLock} from './io.mjs';
const root=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex');
const clean=x=>Number(x.toFixed(12)),obsPath=id=>`analysis/unit-score/observations/${id}-20260909${id==='Z'?'-completed':''}.json`;

export function compareAJAndPlanAK(){
 const checkpoint='analysis/unit-score/experiments/baseline-passive-AJ-20260909.json',plan=read(checkpoint),checkpointHash=hash(checkpoint);
 assert.deepEqual(sourceLock(),plan.sourceHashes);
 for(const [p,h] of Object.entries({...plan.newEvidenceHashes,...plan.observationHashes,...plan.previousSourceLocks}))assert.equal(hash(p),h);
 assert.equal(hash('analysis/unit-score/compare-passive-ai-20260909.mjs'),plan.analysisSourceSHA256);
 assert.equal(hash('analysis/unit-score/experiments/baseline-passive-AI-20260909.json'),plan.AICheckpointSHA256);
 const previous=compareAIAndPlanAJ(),aj=read(obsPath('AJ')),aa=read(obsPath('AA'));
 assert.equal(aj.predictionCheckpointSHA256,checkpointHash);assert.equal(aj.leaderId,plan.leaderId);assert.deepEqual(aj.memberIds,plan.memberIds);assert.deepEqual(aj.profiles,plan.profiles);
 assert.equal(aj.game.overallPower,null);assert.equal(aj.game.scoreBonusPct,null);
 const f=displayedActiveFeatures(aj),sp=quantizedSupportSP(f),b=numericBoardResearch(aj),aaf=displayedActiveFeatures(aa);
 assert.deepEqual(f.memberIds,aaf.memberIds);assert.deepEqual(f.conditions.passiveSupport,aaf.conditions.passiveSupport);assert.deepEqual(f.SP,aaf.SP);
 const comparisons=[
  {item:'memberParameter',predicted:plan.features.power.memberParameter,observed:aj.game.powerDetail.memberParameter},
  {item:'outfitPower',predicted:plan.features.power.outfit,observed:aj.game.powerDetail.outfit},
  {item:'passivePower',predicted:plan.features.power.passive,observed:aj.game.powerDetail.passive},
  {item:'active',predicted:plan.features.A,observed:aj.game.scoreBonusDetail.active},
  {item:'special',predicted:plan.quantized.display,observed:aj.game.scoreBonusDetail.special}
 ].map(c=>({...c,matches:c.predicted===c.observed}));assert.ok(comparisons.every(c=>c.matches));
 const candidateComparisons=plan.hypotheses.passive.candidates.map(c=>({...c,observed:aj.game.scoreBonusDetail.passive,matches:c.possibleDisplays.includes(aj.game.scoreBonusDetail.passive)}));
 assert.ok(candidateComparisons.every(c=>!c.matches));assert.equal(b.joint.reportedSum,13.7);assert.ok(plan.hypotheses.conditionalJoint.possibleDisplays.includes(b.joint.reportedSum));
 const rows=[...previous.rows,{...f,quantized:sp}],distinctMemberSets=new Set(rows.map(r=>[...r.memberIds].sort().join(','))).size;
 assert.equal(rows.length,34);assert.equal(new Set(rows.map(r=>r.id)).size,34);assert.equal(distinctMemberSets,21);
 assert.ok(rows.every(r=>r.A===r.observedActive&&r.quantized.display===r.observedSP));
 const positiveRows=[...previous.extensionAudit.positivePassive.rows,b];assert.equal(positiveRows.length,19);assert.ok(positiveRows.every(r=>r.joint.compatible&&!r.boardMatches));
 const delta={board:clean(aj.game.scoreBonusDetail.board-aa.game.scoreBonusDetail.board),passive:clean(aj.game.scoreBonusDetail.passive-aa.game.scoreBonusDetail.passive),
  joint:clean(b.joint.reportedSum-numericBoardResearch(aa).joint.reportedSum),active:0,special:0,outfitPower:aj.game.powerDetail.outfit-aaf.power.outfit};
 assert.deepEqual(delta,{board:8.9,passive:.7,joint:9.6,active:0,special:0,outfitPower:50131});
 const newRequired={rawMultiplier:{lower:14/8,upper:15/7,lowerClosed:false,upperClosed:false},rawAddend:{lower:.6,upper:.8,lowerClosed:false,upperClosed:false}};
 const universalIntersections={multiplier:{lower:Math.max(plan.latentFamilies.roundingOnly.multiplier.lower,newRequired.rawMultiplier.lower),upper:Math.min(plan.latentFamilies.roundingOnly.multiplier.upper,newRequired.rawMultiplier.upper)},
  addend:{lower:Math.max(plan.latentFamilies.roundingOnly.addend.lower,newRequired.rawAddend.lower),upper:Math.min(plan.latentFamilies.roundingOnly.addend.upper,newRequired.rawAddend.upper)}};
 assert.ok(Object.values(universalIntersections).every(x=>x.lower>x.upper));
 const profilePath='analysis/unit-score/profile-observations/ririka-3star-20260909.json',profileEvidence=read(profilePath);
 assert.equal(profileEvidence.owned,true);assert.deepEqual(profileEvidence.profile,{id:'card-06003-3-nrml-0059-00',level:1,potential:0});
 const nextObservation={sampleId:'AK',leaderId:profileEvidence.cardId,memberIds:[...aj.memberIds],
  profiles:[{...profileEvidence.profile},...aj.memberIds.map(id=>({...aj.profiles.find(p=>p.id===id)}))]};
 const nf=displayedActiveFeatures(nextObservation),nsp=quantizedSupportSP(nf),nb=numericBoardResearch(nextObservation);
 assert.deepEqual(nf.memberIds,f.memberIds);assert.deepEqual(nf.SP,f.SP);assert.deepEqual(nf.conditions,f.conditions);assert.deepEqual(nb.inputs,b.inputs);
 assert.equal(nb.leaderCharacterId,b.leaderCharacterId);assert.equal(nb.leaderBoardSupport,b.leaderBoardSupport);assert.equal(nb.Braw,b.Braw);assert.equal(nb.BPraw,b.BPraw);
 assert.equal(nf.power.memberParameter,100252);assert.equal(nf.power.outfit,15047);assert.equal(nf.power.passive,22531);assert.equal(nf.retainedPower,137830);
 assert.equal(nf.A,71.1);assert.equal(nsp.display,42.2);assert.equal(nf.conditions.leaderScoreSupport,0);
 assert.deepEqual(nb.joint.twoCeilPossibleSums,[13.7,13.8]);
 const cards=read('data/generated/cards.json'),oldCard=cards.find(c=>c.id===aj.leaderId),newCard=cards.find(c=>c.id===nextObservation.leaderId);
 assert.equal(oldCard.character_id,newCard.character_id);assert.equal(newCard.leader.effect[0].value,'150');
 assert.deepEqual(sourceLock(),plan.sourceHashes);assert.equal(hash(checkpoint),checkpointHash);
 return {schemaVersion:1,recordedAt:new Date().toISOString(),scope:'AJ misses both conditional latent leader-conversion ranges; verify parameter-costume magnitude using the same Ririka leader character and confirmed3-star profile. Research only.',
  observation:aj,comparisons,features:f,quantized:sp,numericBoardFeatures:b,candidateComparisons,
  jointComparison:{frozenPossibleDisplays:plan.hypotheses.conditionalJoint.possibleDisplays,observedSum:13.7,compatible:true,status:'Fifth prospective positive-passive conditional-sum check after AF/AG/AH/AI.'},
  rawConversionAudit:{newPair:{base:'AA',leader:'AJ',basePassive:.8,leaderPassive:1.5,delta,newRequired},universalIntersections,
   conclusion:'Neither common raw conversion extends to AA/AJ under the assumed score independence of the parameter costume. Both frozen AJ predictions fail.',
   scope:'The three inactive-costume pairs still fit their earlier ranges. AJ changes parameter-costume state as well as leader character; it does not uniquely identify a costume effect or rule out every conversion restricted to the earlier scope.',
   nextReason:'Stop adding common coefficients and directly compare different parameter-costume magnitudes while preserving the leader character/board context.'},
  arithmetic:{reportedOverallPower:null,reportedScoreBonus:null,memberPlusOutfitPlusPassive:172914,sumOfConfirmedBonusRows:127,status:'Derived subtotals only; overall totals unreported.'},
  extensionAudit:{zeroPassive:previous.extensionAudit.zeroPassive,positivePassive:{rows:positiveRows,total:19,individualBoardMatches:0,jointCompatible:19,
   evidence:{retrospectiveAtAFPlanning:14,prospectiveCompatibilityChecks:['AF','AG','AH','AI','AJ']}}},
  summary:{observations:34,distinctMemberSets,activeMatches:34,refinedSPMatches:34,
   refinedSPEvidence:{retrospectiveAtDiscovery:20,newMemberChecks:['W','AA','AB','AC','AD','AF','AG'],sameMemberLeaderChecks:['X','Y','Z','AE','AH','AI','AJ']},
   passiveStatus:'Both AJ raw conversion predictions fail. Costume interaction versus composition-dependent leader effects unresolved; source-specific effect definitions and existing successful models preserved.'},rows,
  next:{...nextObservation,leaderProfileEvidence:profilePath,leaderProfileConfirmed:true,memberProfilesBasis:'Same as AJ planned/confirmed-by-reference formation.',features:nf,quantized:nsp,numericBoardFeatures:nb,
   changeFromCurrentAJ:'Replace only the leader card: Ririka5-star CEO40/0 -> Ririka3-star We are hololive!1/0. Keep all five members, profiles, order and board unlocks.',
   purpose:'Hold the leader character and documented board nodes fixed while changing the all-parameter costume magnitude50% to15%.',
   leaderCards:{AJ:{id:oldCard.id,name:oldCard.name,profile:aj.profiles.find(p=>p.id===oldCard.id),effect:oldCard.leader.description,appliedParameterPct:50},
    AK:{id:newCard.id,name:newCard.name,profile:profileEvidence.profile,effect:newCard.leader.description,appliedParameterPct:15}},
   fixed:{memberIds:aj.memberIds,memberBoardInputs:b.inputs,leaderCharacterId:b.leaderCharacterId,leaderBoardSupport:13.3,
    passiveRecipients:aj.memberIds.filter((_,i)=>f.conditions.passiveSupport[i]>0),supportPerRecipient:8,activeSPConditionsUnchanged:true,scoreSupportCostume:0},
   hypotheses:{active:{display:nf.A,kind:'Existing board-excluded formula'},special:{display:nsp.display,kind:'Existing board-excluded formula'},
    passive:{display:1.5,kind:'New control hypothesis: same displayed passive as AJ if the parameter-costume magnitude/leader-card change has no score interaction. Not a general passive formula.'},
    board:{display:12.2,kind:'Same-context invariance control paired with passive1.5; not a standalone category formula.'},
    conditionalJoint:{possibleDisplays:[13.7,13.8],raw:nb.joint.rawCombined,kind:'Existing conditional raw-sum/separate-ceil model, which excludes parameter-only costume from score.'}},
   parameterPowerDelta:15047-50131,
   interpretation:{bothUnchanged:'Supports score invariance under this50-to15 parameter-costume/card change; makes composition-dependent leader effects a stronger direction. It does not prove all parameter costumes or on/off changes irrelevant.',
    anyScoreChange:'Refutes invariance under the leader-card change; inspect costume/card dependence while member and leader-board inputs are held fixed. Do not immediately identify a unique costume formula.',
    limitation:'Both parameter costumes are on. Equality cannot rule out a binary activation-state interaction. A later on/off same-character control may be needed.'},
   assumptions:'Same pre-song formation detail; leader boards depend on the same Ririka character and their unlocks stay fixed. Leader member skills remain excluded as in the current model. Ayame singer nodes excluded; Raden life600 and regular Kanade combo100 assumed met.',
   limitations:'The leader card also has different member-role skills and growth; the model treats those skills as inactive in the leader slot. A changed score would identify dependence on this card/costume context, not by itself a unique causal node. Ririka judgement-node contribution, G0.1 residual and Ayame score-support outfit remain unresolved.',
   requestedMeasurements:'Member parameter, outfit power, passive power, Active, SP, and board/passive score separately. Total score bonus if available.'},
  provenance:{AJCheckpointSHA256:checkpointHash,AJObservationSHA256:hash(obsPath('AJ')),sourceHashes:sourceLock(),
   newEvidenceHashes:{...plan.newEvidenceHashes,[profilePath]:hash(profilePath)},previousObservationHashes:plan.observationHashes,
   previousSourceLocks:{...plan.previousSourceLocks,'analysis/unit-score/compare-passive-ai-20260909.mjs':plan.analysisSourceSHA256},predictionsAndProductionUnchanged:true}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(compareAJAndPlanAK(),null,2));
