import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { planAS } from './plan-no-timing-as-20260909.mjs';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { round1 } from './dummy-model-lab.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function compareAS() {
  const checkpoint = 'analysis/unit-score/experiments/baseline-no-timing-AS-20260909.json';
  const observationPath = 'analysis/unit-score/observations/AS-20260909.json';
  const plan = read(checkpoint), o = read(observationPath), previous = read(plan.provenance.precedingReport);
  assert.deepEqual(plan, planAS());
  assert.equal(o.predictionCheckpointSHA256, hash(checkpoint));
  for (const k of ['leaderId', 'memberIds', 'profiles', 'boardOverrides']) assert.deepEqual(o[k], plan[k]);
  const features = allocationFeatures(o), prediction = proportionalAllocation(features, { countMode: 'fractional' });
  const score = o.game.scoreBonusDetail, joint = Number((score.passive + score.board).toFixed(9));
  const direct = { passive: round1(features.BPraw - features.Braw), board: round1(features.Braw - features.Araw) };
  return { schemaVersion: 1, latestObserved: 'AS', observation: o, features, prediction,
    comparisons: { rawProportional: { expected: plan.hypotheses.rawProportional, matches: prediction.passiveMatches && prediction.boardMatches },
      directMarginal: { expected: direct, matches: direct.passive === score.passive && direct.board === score.board } },
    joint: { raw: features.raw, possibleDisplays: plan.hypotheses.joint.possibleDisplays, observed: joint, compatible: plan.hypotheses.joint.possibleDisplays.includes(joint) },
    summary: { ...previous.summary, observations: previous.summary.observations + 1,
      positivePassiveJointCompatibility: previous.summary.positivePassiveJointCompatibility + Number(plan.hypotheses.joint.possibleDisplays.includes(joint)),
      prospectiveJointChecks: [...previous.summary.prospectiveJointChecks, 'AS'], ASActiveSPUnreported: true },
    interpretation: { supported: 'Under the requested zero member timing-board baseline, passive3.0/board10.1 supports the frozen proportional prediction and rejects direct marginal board10.0. Member timing effects alone cannot explain the attribution difference in this control.',
      caveats: ['Only two numbers were supplied. Active/SP, power and totals remain unreported.',
        'Zero member timing and unchanged Ririka/other effects inherit the request; no independent node audit or answer about collateral effects was supplied.',
        'Five historical raw-fractional discrepancies remain; this is a scoped control result, not a complete formula.',
        'Ririka judgment and other unmodeled effects are not claimed absent.'], productionFormulaChanged: false },
    provenance: { checkpoint, checkpointSHA256: hash(checkpoint), observationPath, observationSHA256: hash(observationPath),
      previousReport: plan.provenance.precedingReport, previousReportSHA256: hash(plan.provenance.precedingReport),
      analysisSourceSHA256: hash('analysis/unit-score/compare-as-20260909.mjs'), sourceHashes: plan.provenance.sourceHashes } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareAS(), null, 2));
