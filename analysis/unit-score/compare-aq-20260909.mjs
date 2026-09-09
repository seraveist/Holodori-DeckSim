import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { planAQ } from './plan-rate-aq-20260909.mjs';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
const sum = values => Number(values.filter(v => v != null).reduce((a, b) => a + b, 0).toFixed(9));
export function compareAQ() {
  const checkpoint = 'analysis/unit-score/experiments/baseline-rate-AQ-20260909.json';
  const observationPath = 'analysis/unit-score/observations/AQ-20260909.json';
  const plan = read(checkpoint), o = read(observationPath);
  assert.deepEqual(plan, planAQ());
  assert.equal(o.predictionCheckpointSHA256, hash(checkpoint));
  assert.equal(hash(o.screenshot.path), o.screenshot.sha256);
  for (const k of ['leaderId', 'memberIds', 'profiles', 'boardOverrides']) assert.deepEqual(o[k], plan[k]);
  const previous = read(plan.provenance.reportPath), f = displayedActiveFeatures(o), sp = quantizedSupportSP(f);
  const features = allocationFeatures(o), finite = proportionalAllocation(features), fractional = proportionalAllocation(features, { countMode: 'fractional' });
  const expected = { memberParameter: f.power.memberParameter, outfitPower: f.power.outfit, passivePower: f.power.passive, active: f.A, special: sp.display };
  assert.deepEqual(expected, plan.baselineValues);
  const observed = { memberParameter: o.game.powerDetail.memberParameter, outfitPower: o.game.powerDetail.outfit,
    passivePower: o.game.powerDetail.passive, active: o.game.scoreBonusDetail.active, special: o.game.scoreBonusDetail.special };
  const comparisons = Object.entries(expected).map(([key, predicted]) => ({ key, predicted, observed: observed[key], matches: predicted === observed[key] }));
  const joint = sum([o.game.scoreBonusDetail.passive, o.game.scoreBonusDetail.board]);
  return { schemaVersion: 1, latestObserved: 'AQ', observation: o, baselineComparisons: comparisons, features,
    frozenHypotheses: { finite200: { ...finite, pairMatches: finite.passiveMatches && finite.boardMatches },
      fractionalCount: { ...fractional, pairMatches: fractional.passiveMatches && fractional.boardMatches } },
    joint: { raw: features.raw, possibleDisplays: plan.hypotheses.joint.possibleDisplays,
      observed: joint, compatible: plan.hypotheses.joint.possibleDisplays.includes(joint) },
    arithmetic: { visiblePowerSum: sum(Object.values(o.game.powerDetail)), reportedPower: o.game.overallPower,
      visibleScoreSum: sum(Object.values(o.game.scoreBonusDetail)), reportedScore: o.game.scoreBonusPct },
    summary: { ...previous.summary, observations: previous.summary.observations + 1,
      activeObserved: previous.summary.activeObserved + 1, activeMatches: previous.summary.activeMatches + Number(observed.active === f.A),
      spObserved: previous.summary.spObserved + 1, spMatches: previous.summary.spMatches + Number(observed.special === sp.display),
      confirmedPowerComponents: previous.summary.confirmedPowerComponents + comparisons.slice(0, 3).filter(v => v.matches).length,
      positivePassiveJointCompatibility: previous.summary.positivePassiveJointCompatibility + Number(plan.hypotheses.joint.possibleDisplays.includes(joint)),
      prospectiveJointChecks: [...previous.summary.prospectiveJointChecks, 'AQ'] },
    interpretation: { finite200PredictionRejected: !finite.passiveMatches, fractionalAlternativeMatchesThisControl: fractional.passiveMatches && fractional.boardMatches,
      oldFormulaProspectivePairs: { matched: 1, measured: 2, success: ['AP'], failure: ['AQ'] },
      caveats: ['Cards, growth and node changes inherit the AQ request; this detail image does not audit them.',
        'One alternative match does not establish a general formula. The rejected finite prediction remains frozen.',
        'The AQ plan and question preceded the image; its Git checkpoint commit occurred after receipt.',
        'Overall power arithmetic is checked, but board/memory/enhancement are not predicted. Final unit score remains unreported.'],
      productionFormulaChanged: false },
    provenance: { checkpoint, checkpointSHA256: hash(checkpoint), observationPath, observationSHA256: hash(observationPath),
      previousReport: plan.provenance.reportPath, previousReportSHA256: hash(plan.provenance.reportPath),
      analysisSourceSHA256: hash('analysis/unit-score/compare-aq-20260909.mjs'), sourceHashes: plan.provenance.sourceHashes } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareAQ(), null, 2));
