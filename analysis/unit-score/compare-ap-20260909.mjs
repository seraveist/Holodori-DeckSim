import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { planAP } from './plan-frequency-ap-20260909.mjs';
import { compareAO } from './compare-ao-20260909.mjs';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
const sum = values => Number(values.filter(v => v != null).reduce((a, b) => a + b, 0).toFixed(9));

export function compareAP() {
  const checkpoint = 'analysis/unit-score/experiments/baseline-frequency-AP-20260909.json';
  const observationPath = 'analysis/unit-score/observations/AP-20260909.json';
  const plan = read(checkpoint), o = read(observationPath), previous = compareAO();
  assert.deepEqual(plan, planAP());
  assert.equal(o.predictionCheckpointSHA256, hash(checkpoint));
  assert.equal(hash(o.screenshot.path), o.screenshot.sha256);
  for (const k of ['leaderId', 'memberIds', 'profiles', 'boardOverrides']) assert.deepEqual(o[k], plan[k]);
  const f = displayedActiveFeatures(o), sp = quantizedSupportSP(f), features = allocationFeatures(o);
  const prediction = proportionalAllocation(features), g = o.game;
  const expected = { memberParameter: f.power.memberParameter, outfitPower: f.power.outfit, passivePower: f.power.passive,
    active: f.A, special: sp.display, passive: prediction.passive, board: prediction.board };
  const observed = { memberParameter: g.powerDetail.memberParameter, outfitPower: g.powerDetail.outfit,
    passivePower: g.powerDetail.passive, active: g.scoreBonusDetail.active, special: g.scoreBonusDetail.special,
    passive: g.scoreBonusDetail.passive, board: g.scoreBonusDetail.board };
  assert.deepEqual(expected, { ...plan.baselineValues, passive: plan.prediction.passive, board: plan.prediction.board });
  const comparisons = Object.entries(expected).map(([key, value]) => ({ key, predicted: value, observed: observed[key], matches: value === observed[key] }));
  const joint = sum([observed.passive, observed.board]);
  const pairMatches = prediction.passiveMatches && prediction.boardMatches;
  const retrospective = read(plan.provenance.probeReport);
  return { schemaVersion: 1, latestObserved: 'AP', observation: o, comparisons, features, prediction,
    joint: { raw: features.raw, possibleDisplays: plan.hypotheses.joint.possibleDisplays,
      observed: joint, compatible: plan.hypotheses.joint.possibleDisplays.includes(joint) },
    arithmetic: { visiblePowerSum: sum(Object.values(g.powerDetail)), reportedPower: g.overallPower,
      powerMatches: sum(Object.values(g.powerDetail)) === g.overallPower,
      visibleScoreSum: sum(Object.values(g.scoreBonusDetail)), reportedScore: g.scoreBonusPct,
      scoreMatches: sum(Object.values(g.scoreBonusDetail)) === g.scoreBonusPct,
      AOtoAP: { passive: sum([observed.passive, -previous.observation.game.scoreBonusDetail.passive]),
        board: sum([observed.board, -previous.observation.game.scoreBonusDetail.board]), joint: sum([joint, -previous.arithmetic.derivedJoint]) } },
    summary: { ...previous.summary, observations: previous.summary.observations + 1,
      activeObserved: previous.summary.activeObserved + 1, activeMatches: previous.summary.activeMatches + Number(observed.active === f.A),
      spObserved: previous.summary.spObserved + 1, spMatches: previous.summary.spMatches + Number(observed.special === sp.display),
      confirmedPowerComponents: previous.summary.confirmedPowerComponents + comparisons.slice(0, 3).filter(v => v.matches).length,
      positivePassiveJointCompatibility: previous.summary.positivePassiveJointCompatibility + Number(plan.hypotheses.joint.possibleDisplays.includes(joint)),
      prospectiveJointChecks: [...previous.summary.prospectiveJointChecks, 'AP'] },
    allocationEvidence: { retrospectiveThrough: 'AO', retrospectivePairs: retrospective.summary.matches,
      retrospectiveObservations: retrospective.eligibleObservations, prospectiveObservations: 1, prospectivePairs: Number(pairMatches),
      combinedPairs: retrospective.summary.matches + Number(pairMatches), combinedObservations: retrospective.eligibleObservations + 1,
      combinedPassiveMatches: retrospective.summary.passiveMatches + Number(prediction.passiveMatches),
      combinedBoardMatches: retrospective.summary.boardMatches + Number(prediction.boardMatches),
      historicalFailures: retrospective.summary.failures, generalFormulaConfirmed: false },
    interpretation: { supported: 'AP is the first prospective success for the proportional allocation selected after AO. Under the requested controls, disabling Noel frequency increases the combined display11.1->14.4, as the existing200-second overlap model predicted.',
      caveats: ['The screenshot supplies all displayed numbers, but cards, growth, node states and pre-song context inherit the AP request; they are not visible in the detail panel.',
        'The plan and question preceded this image. Its Git checkpoint was committed after the image arrived; Git commit time is not the prospective evidence.',
        'Power board23808, memory4432 and enhancement873 are recorded, not predicted or counted as formula validation.',
        'Four historical0.1-point category failures remain. This does not identify a unique internal duration or generalize to actual-song scores.'],
      productionFormulaChanged: false },
    provenance: { checkpoint, checkpointSHA256: hash(checkpoint), observationPath, observationSHA256: hash(observationPath),
      analysisSourceSHA256: hash('analysis/unit-score/compare-ap-20260909.mjs'), sourceHashes: plan.provenance.sourceHashes,
      probeSourceSHA256: plan.provenance.probeSourceSHA256, predictionsAndProductionUnchanged: true } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareAP(), null, 2));
