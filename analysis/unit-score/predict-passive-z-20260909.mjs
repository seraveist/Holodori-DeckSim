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

export function predictZ(){
 const y=read('analysis/unit-score/observations/Y-20260909.json');
 const prior=read('analysis/unit-score/experiments/baseline-passive-Y-20260909.json');
 const boardPath='analysis/unit-score/board-observations/suisei-Y-clarification-20260909.json',board=read(boardPath);
 assert.equal(board.characterId,'chr-00018');assert.equal(board.relevantLeaderBoardEffectsAbsentConfirmed,true);
 assert.deepEqual(sourceLock(),prior.sourceHashes);
 const leaderId='card-00018-5-uniq-0068-00';
 const o={sampleId:'Z',leaderId,memberIds:y.memberIds,profiles:[leaderId,...y.memberIds].map(id=>({...fixture.profiles.find(p=>p.id===id)}))};
 const f=displayedActiveFeatures(o),sp=quantizedSupportSP(f),leader=prepared.get(leaderId);
 assert.equal(f.conditions.leaderParameterConditionMet,false);assert.equal(f.conditions.leaderScoreSupport,0);
 assert.equal(f.power.outfit,0);assert.equal(f.power.memberParameter,100252);assert.equal(f.power.passive,12584);
 assert.equal(f.retainedPower,112836);assert.equal(f.A,75.5);assert.equal(sp.display,43.2);
 assert.deepEqual(f.conditions.passiveSupport,[0,0,8,0,8]);
 assert.ok(o.memberIds.every(id=>!prepared.get(id).groupings.has('grp-gen_0')));
 return {...o,features:f,quantized:sp,leaderDescription:leader.leader.description,
  change:'Y: replace regular Kanade leader 80/0 with swimsuit Suisei leader 60/0. Keep Ayame, Towa, Raden, swimsuit Noel, swimsuit Watame and their growth unchanged.',
  view:'Continue the same pre-song-selection formation detail view.',
  controls:{againstXY:'All five members fixed; both leader characters have confirmed no relevant leader-board effects. Active parameter costume becomes inactive.',
   againstW:'All five members fixed and both parameter costumes inactive. Ririka score-related leader boards are present in W but absent for Suisei in Z.'},
  assumptions:'Leader member skills are excluded. No generation-0 member exists, so Suisei sense +135% costume condition fails. Raden life >=600 stays assumed met. Baseline Active/SP exclude boards.',
  hypotheses:{passive:{preferredDisplay:1.5,status:'Invariance hypothesis derived from X/Y, not a solved formula.',
    condition:'If the X/Y passive baseline does not depend on whether a parameter-only costume is active, Z remains 1.5.'},
   alternatePassive:{display:1.9,status:'Diagnostic alternative from W, not a separately derived formula.',
    condition:'A return to W passive 1.9 despite absent relevant Suisei leader boards would challenge a leader-board-only explanation and prioritize inactive-vs-active costume context.'},
   displayedBoard:{display:6.9,status:'Same member boards and no relevant leader-board effects: observed-X/Y invariance hypothesis, not a solved board formula.'}},
  interpretation:{passive1_5:'Supports W leader-board/leader-character context as the difference, while active-vs-inactive parameter costume invariance holds for Kanade/Suisei in this member set.',
   passive1_9:'Does not support a board-only interpretation of W versus X/Y; inspect parameter-costume activation context and other changed leader factors.',
   other:'Record all categories and profile differences before introducing an adjustment.'},
  limitations:['Leader character changes, so this does not isolate a specific Ririka node or prove that the 13.3% sum causes exactly +0.4.',
   'The low-probability judgement node and the conditional singer node remain unquantified. No unconditional 24% addition.',
   'Power/stat formulas and Active/SP predictions are distinct from the passive/board invariance hypotheses.'],
  requestedMeasurements:'Total power; member, outfit and passive power; total score bonus; Active, SP, passive, board, and outfit score presence/value.',
  sourceHashes:sourceLock(),newEvidenceHashes:{...prior.newEvidenceHashes,[boardPath]:hash(boardPath)},
  YObservationSHA256:hash('analysis/unit-score/observations/Y-20260909.json'),
  YCheckpointSHA256:hash('analysis/unit-score/experiments/baseline-passive-Y-20260909.json')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(predictZ(),null,2));
