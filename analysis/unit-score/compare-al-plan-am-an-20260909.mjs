import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { planAL } from './plan-passive-al-20260909.mjs';
import { compareAK } from './compare-passive-ak-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
import { numericBoardResearch } from './compare-board-ae-20260909.mjs';
import { prepareScoreCards } from '../../js/card-prepare.js';
import { sourceLock } from './io.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');

export function compareALAndPlanPair() {
  const checkpoint = 'analysis/unit-score/experiments/baseline-passive-AL-20260909.json';
  const observationPath = 'analysis/unit-score/observations/AL-20260909.json';
  const plan = read(checkpoint), observation = read(observationPath), previous = compareAK();
  assert.deepEqual(planAL(), plan);
  assert.equal(hash(checkpoint), observation.predictionCheckpointSHA256);
  assert.equal(observation.leaderId, plan.leaderId);
  assert.deepEqual(observation.memberIds, plan.memberIds);
  assert.deepEqual(observation.profiles, plan.profiles);
  const f = displayedActiveFeatures(observation), sp = quantizedSupportSP(f), b = numericBoardResearch(observation);
  const values = { memberParameter: f.power.memberParameter, outfitPower: f.power.outfit, passivePower: f.power.passive,
    active: f.A, special: sp.display, passive: plan.hypotheses.passive.display, board: plan.hypotheses.board.display };
  const observed = { memberParameter: observation.game.powerDetail.memberParameter, outfitPower: observation.game.powerDetail.outfit,
    passivePower: observation.game.powerDetail.passive, ...observation.game.scoreBonusDetail };
  const comparisons = Object.entries(values).map(([item, predicted]) => ({ item, predicted, observed: observed[item], matches: predicted === observed[item] }));
  assert.ok(comparisons.every(c => c.matches));
  assert.deepEqual(observation.confirmedByReference.fields, values);
  assert.equal(b.joint.reportedSum, 17.9);
  assert.equal(b.joint.compatible, true);
  for (const key of ['unitScore', 'overallPower', 'scoreBonusPct']) assert.equal(observation.game[key], null);
  for (const key of ['board', 'memory', 'enhancement']) assert.equal(observation.game.powerDetail[key], null);
  assert.equal(observation.game.scoreBonusDetail.outfit, null);
  const profiles = read('analysis/unit-score/validation-cards.import.json').ownedCards;
  const next = [['AM', 'card-00018-5-uniq-0068-00'], ['AN', 'card-06002-5-uniq-0066-00']].map(([sampleId, last]) => {
    const memberIds = [observation.memberIds[0], observation.memberIds[1], 'card-00022-5-uniq-0063-00', observation.memberIds[3], last];
    const o = { sampleId, leaderId: observation.leaderId, memberIds,
      profiles: [observation.profiles[0], ...memberIds.map(id => observation.profiles.find(p => p.id === id) ?? profiles.find(p => p.id === id))] };
    const features = displayedActiveFeatures(o), special = quantizedSupportSP(features), board = numericBoardResearch(o);
    return { ...o, status: 'Planned; no measurement received',
      baselineValues: { memberParameter: features.power.memberParameter, outfitPower: features.power.outfit,
        passivePower: features.power.passive, active: features.A, special: special.display },
      passive: null, board: null, conditionalJoint: { raw: board.joint.rawCombined, possibleDisplays: board.joint.twoCeilPossibleSums },
      supportByMember: features.conditions.passiveSupport, boardInputs: board.inputs, SP: features.SP,
      Araw: features.Araw, sourceHashes: sourceLock() };
  });
  assert.equal(next[0].Araw, next[1].Araw);
  assert.deepEqual(next[0].supportByMember, [0, 0, 9, 9, 0]);
  assert.deepEqual(next[0].supportByMember, next[1].supportByMember);
  assert.deepEqual(next[0].memberIds.slice(0, 4), next[1].memberIds.slice(0, 4));
  assert.deepEqual(next[0].boardInputs.slice(0, 4), next[1].boardInputs.slice(0, 4));
  assert.deepEqual(next.map(n => n.boardInputs[4].board), [{ rate: 0, cooldown: 0 }, { rate: 20, cooldown: 0 }]);
  const cards = prepareScoreCards(read('data/generated/cards.json'), new Map(read('data/generated/characters.json').map(c => [c.id, c])),
    Object.fromEntries(profiles.map(p => [p.id, p])), { masterRefs: read('data/generated/master_refs.json'), levelMode: 'current' });
  assert.deepEqual(cards.get(next[0].memberIds[4]).active, cards.get(next[1].memberIds[4]).active);
  const summary = { observations: previous.summary.observations + 1, distinctMemberSets: previous.summary.distinctMemberSets,
    activeObserved: previous.summary.activeObserved + 1, activeMatches: previous.summary.activeMatches + 1,
    spObserved: previous.summary.spObserved + 1, spMatches: previous.summary.spMatches + 1, confirmedPowerComponents: 91,
    positivePassiveJointCompatibility: previous.summary.positivePassiveJointCompatibility + 1,
    retrospectiveJointChecks: 14, prospectiveJointChecks: [...previous.summary.prospectiveJointChecks, 'AL'],
    AKActiveSPUnreported: true, individualPassiveFormulaConfirmed: false, individualBoardFormulaConfirmed: false };
  return { schemaVersion: 1, latestObserved: 'AL', observation, comparisons, summary,
    jointComparison: { derivedSum: b.joint.reportedSum, frozenPossibleDisplays: plan.hypotheses.conditionalJoint.possibleDisplays, compatible: b.joint.compatible },
    arithmetic: { powerSubtotal: f.retainedPower, sumOfConfirmedScoreRows: Number((f.A + sp.display + b.joint.reportedSum).toFixed(9)),
      status: 'Derived subtotals; full power, total bonus and final unit score not provided.' },
    interpretation: 'AI->AL preserves displayed passive2.2/board15.7 with parameter costume inactive->15% active. Together with AK50%->15% active control, simple parameter-costume magnitude/on-off explanations weaken in these tested contexts; general allocation remains unresolved.',
    next: { experimentIds: ['AM', 'AN'], observationsReceived: [], plans: next,
      purpose: 'Hold the five base Active skill profiles and Noel/Flare9% support recipients fixed while replacing a nonrecipient with identical Active and different known timing-board inputs.',
      relationshipHypothesis: { passiveDifference: 0, kind: 'Null hypothesis for a split based only on base Active/support/leader inputs. Neither individual passive value is predicted.' },
      controls: { leader: 'Same Ririka3-star1/0, active15% parameter costume, same recorded leader boards.',
        passiveProvider: 'Noel only;9% on Noel and regular Flare. Suisei0-generation condition is false; Kanade Happy stat condition is false.',
        swapActive: { interval: 23, probability: 0.46, duration: 8, value: 100 },
        order: 'Only slot5 changes between AM and AN. No growth or board unlock changes.' },
      confounders: ['SP duration/support changes: Suisei12s/100 ->Kanade14s/95.', 'Member stats, attribute and character change; neither swapped card receives Noel support.', 'This is not a board-only intervention.'],
      decisions: { passiveSame: 'No detectable change at displayed precision; do not prove unrounded equality or universal board independence.',
        passiveDifferent: 'Rejects base-Active/support/leader-only invariance. Board-modified competition, SP or another changed card property remains a candidate.',
        sumFails: 'Recheck inputs and combined model; preserve the frozen failed prediction.',
        activeDiffers: 'The base Active model expects identical75.2; investigate input identity or model before allocation inference.' },
      requestedMeasurements: 'For AM and AN separately: passive score and Holomember board score, plus Active/SP and the three power rows if available. Same pre-song detail view.' },
    provenance: { checkpoint, checkpointSHA256: hash(checkpoint), observationPath, observationSHA256: hash(observationPath),
      analysisSourceSHA256: hash('analysis/unit-score/compare-al-plan-am-an-20260909.mjs'), sourceHashes: sourceLock(),
      additionalInputs: { 'analysis/unit-score/validation-cards.import.json': hash('analysis/unit-score/validation-cards.import.json') },
      predictionsAndProductionUnchanged: true } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareALAndPlanPair(), null, 2));
