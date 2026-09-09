import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { planARRevised } from './plan-rounded-ar-revised-20260909.mjs';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { roundedAllocation } from './probe-rounded-allocation-aq-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
import { round1 } from './dummy-model-lab.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
const sum = values => Number(values.filter(v => v != null).reduce((a, b) => a + b, 0).toFixed(9));
export function compareAR() {
  const checkpoint = 'analysis/unit-score/experiments/baseline-rounded-AR-revised-20260909.json';
  const observationPath = 'analysis/unit-score/observations/AR-20260909.json';
  const plan = read(checkpoint), o = read(observationPath);
  assert.deepEqual(plan, planARRevised());
  assert.equal(o.predictionCheckpointSHA256, hash(checkpoint));
  assert.equal(hash(o.screenshot.path), o.screenshot.sha256);
  for (const k of ['leaderId', 'memberIds', 'profiles', 'boardOverrides']) assert.deepEqual(o[k], plan[k]);
  const previous = read('analysis/unit-score/reports/AQ-comparison-20260909.json');
  const f = displayedActiveFeatures(o), sp = quantizedSupportSP(f), features = allocationFeatures(o);
  const rounded = roundedAllocation(features), raw = proportionalAllocation(features, { countMode: 'fractional' });
  const expected = { memberParameter: f.power.memberParameter, outfitPower: f.power.outfit, passivePower: f.power.passive, active: f.A, special: sp.display };
  assert.deepEqual(expected, plan.baselineValues);
  const observed = { memberParameter: o.game.powerDetail.memberParameter, outfitPower: o.game.powerDetail.outfit,
    passivePower: o.game.powerDetail.passive, active: o.game.scoreBonusDetail.active, special: o.game.scoreBonusDetail.special };
  const comparisons = Object.entries(expected).map(([key, predicted]) => ({ key, predicted, observed: observed[key], matches: predicted === observed[key] }));
  const joint = sum([o.game.scoreBonusDetail.passive, o.game.scoreBonusDetail.board]);
  const possible = [round1(features.raw), sum([round1(features.raw), .1])];
  const roundedMaximum = sum([rounded.roundedIncrement, .1]);
  return { schemaVersion: 1, latestObserved: 'AR', observation: o, baselineComparisons: comparisons, features,
    frozenHypotheses: { roundedFractional: { ...rounded, pairMatches: rounded.passiveMatches && rounded.boardMatches },
      rawFractional: { ...raw, pairMatches: raw.passiveMatches && raw.boardMatches } },
    joint: { raw: features.raw, possibleDisplays: possible, observed: joint, compatible: possible.includes(joint) },
    structuralRejection: { modeledRoundedIncrement: rounded.roundedIncrement, maximumTwoCeilDisplaySum: roundedMaximum,
      observedDisplaySum: joint, impossibleAtAnyAllocationRatio: joint > roundedMaximum,
      proof: 'For nonnegative x+y=14.0, both0.1-ceil values sum to14.0 or14.1. Observed2.4+11.8=14.2 therefore rejects this rounded increment regardless of the split ratio. The conclusion uses the requested board inputs.' },
    arithmetic: { visiblePowerSum: sum(Object.values(o.game.powerDetail)), reportedPower: o.game.overallPower,
      visibleScoreSum: sum(Object.values(o.game.scoreBonusDetail)), reportedScore: o.game.scoreBonusPct },
    summary: { ...previous.summary, observations: previous.summary.observations + 1,
      activeObserved: previous.summary.activeObserved + 1, activeMatches: previous.summary.activeMatches + Number(observed.active === f.A),
      spObserved: previous.summary.spObserved + 1, spMatches: previous.summary.spMatches + Number(observed.special === sp.display),
      confirmedPowerComponents: previous.summary.confirmedPowerComponents + comparisons.slice(0, 3).filter(v => v.matches).length,
      positivePassiveJointCompatibility: previous.summary.positivePassiveJointCompatibility + Number(possible.includes(joint)),
      prospectiveJointChecks: [...previous.summary.prospectiveJointChecks, 'AR'] },
    interpretation: { roundedFormulaProspectivePairs: { matched: 0, measured: 1, failures: ['AR'] },
      retrospectivePairsThroughAQ: '26/26; remain retrospective after this failure',
      caveats: ['AR identifies the revised one-node control, not the infeasible initial two-node plan. The dependency answer was not a score observation.',
        'Cards, growth and exact node states are inherited from the request, not separately visible in this image.',
        'Raw fractional allocation matches AQ and AR, but still fails five historical observations; it is not accepted as a complete formula.',
        'Master references contain only triggers, active and passive effects; displayed board-node internal precision is not available from them.',
        'Final unit score and actual-song scores are still unmeasured.'], productionFormulaChanged: false },
    provenance: { checkpoint, checkpointSHA256: hash(checkpoint), observationPath, observationSHA256: hash(observationPath),
      previousReport: 'analysis/unit-score/reports/AQ-comparison-20260909.json', previousReportSHA256: hash('analysis/unit-score/reports/AQ-comparison-20260909.json'),
      analysisSourceSHA256: hash('analysis/unit-score/compare-ar-20260909.mjs'), sourceHashes: plan.provenance.sourceHashes } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareAR(), null, 2));
