import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { planAT, leaderInterventionFeatures } from './plan-leader-at-20260909.mjs';
import { proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { round1 } from './dummy-model-lab.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function compareAT() {
  const checkpoint = 'analysis/unit-score/experiments/baseline-leader-AT-20260909.json';
  const observationPath = 'analysis/unit-score/observations/AT-20260909.json';
  const plan = read(checkpoint), o = read(observationPath), previous = read(plan.provenance.precedingReport);
  assert.deepEqual(plan, planAT()); assert.equal(o.predictionCheckpointSHA256, hash(checkpoint));
  for (const k of ['leaderId', 'memberIds', 'profiles', 'boardOverrides', 'leaderSupportOverride']) assert.deepEqual(o[k], plan[k]);
  const features = leaderInterventionFeatures(o), prediction = proportionalAllocation(features, { countMode: 'fractional' });
  const score = o.game.scoreBonusDetail, joint = Number((score.passive + score.board).toFixed(9));
  const direct = { passive: round1(features.BPraw - features.Braw), board: round1(features.Braw - features.Araw) };
  const asDirectBoardRaw = previous.features.Braw - previous.features.Araw, atDirectBoardRaw = features.Braw - features.Araw;
  const deltaLower = Math.max(previous.observation.game.scoreBonusDetail.board - .1 - asDirectBoardRaw, score.board - .1 - atDirectBoardRaw, 0);
  const deltaUpper = Math.min(previous.observation.game.scoreBonusDetail.board - asDirectBoardRaw, score.board - atDirectBoardRaw);
  return { schemaVersion: 1, latestObserved: 'AT', observation: o, features, prediction,
    comparisons: { rawProportional: { expected: plan.hypotheses.rawProportional, matches: prediction.passiveMatches && prediction.boardMatches },
      directMarginal: { expected: direct, matches: direct.passive === score.passive && direct.board === score.board } },
    joint: { raw: features.raw, possibleDisplays: plan.hypotheses.joint.possibleDisplays, observed: joint, compatible: plan.hypotheses.joint.possibleDisplays.includes(joint) },
    summary: { ...previous.summary, observations: previous.summary.observations + 1,
      positivePassiveJointCompatibility: previous.summary.positivePassiveJointCompatibility + Number(plan.hypotheses.joint.possibleDisplays.includes(joint)),
      prospectiveJointChecks: [...previous.summary.prospectiveJointChecks, 'AT'], ATActiveSPUnreported: true },
    diagnostic: { asDirectBoardRaw, atDirectBoardRaw,
      hypotheticalCommonAdditionalBoardContribution: { lowerExclusive: deltaLower, upperInclusive: deltaUpper, feasible: deltaLower < deltaUpper },
      meaning: 'A small common omitted contribution can reconcile direct-board AS and AT ceil displays at the displayed support inputs. This is an interval inferred after measurement, not a measured judgment coefficient or a production correction.',
      alternatives: ['Displayed board-node values may hide internal precision; this is unverified.', 'Attribution could follow another nonlinear rule.'] },
    interpretation: { supported: 'AT passive3.0/board7.7 matches direct marginal and rejects the raw-proportional board7.8 prediction. AS supported the opposite board comparison, so neither exact displayed-input formula explains both controls.',
      caveats: ['Only two score rows were answered. Active/SP, totals and power remain missing.',
        'Leader3.1% removal and retention of other nodes inherit the request. No separate node audit was supplied.',
        'Do not adopt a hidden-precision or judgment coefficient from two rounded values.'], productionFormulaChanged: false },
    provenance: { checkpoint, checkpointSHA256: hash(checkpoint), observationPath, observationSHA256: hash(observationPath),
      previousReport: plan.provenance.precedingReport, previousReportSHA256: hash(plan.provenance.precedingReport),
      analysisSourceSHA256: hash('analysis/unit-score/compare-at-20260909.mjs'), sourceHashes: plan.provenance.sourceHashes } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareAT(), null, 2));
