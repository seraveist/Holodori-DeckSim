import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAP } from '../analysis/unit-score/plan-frequency-ap-20260909.mjs';
import { probeProportionalAllocation, proportionalAllocation } from '../analysis/unit-score/probe-proportional-allocation-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyAPPlan() {
  const plan = planAP();
  assert.deepEqual(plan, read('analysis/unit-score/experiments/baseline-frequency-AP-20260909.json'));
  assert.equal(hash(plan.provenance.probeReport), plan.provenance.probeReportSHA256);
  const probe = probeProportionalAllocation();
  assert.deepEqual(probe, read(plan.provenance.probeReport));
  assert.equal(probe.eligibleObservations, 24);
  assert.equal(probe.summary.matches, 20);
  assert.equal(probe.summary.passiveMatches, 22);
  assert.equal(probe.summary.boardMatches, 22);
  assert.deepEqual(probe.summary.failures, ['W', 'AA', 'AF', 'AH']);
  assert.equal(probe.search.coefficientFamilies, 168);
  assert.equal(probe.search.freeTiming.attempts, 1713);
  assert.deepEqual(probe.search.perfectVariants, []);
  assert.deepEqual(probe.search.freeTiming.perfectCandidates, []);
  assert.equal(probe.evidence.independentPredictions, 0);
  assert.equal(probe.evidence.allMatchesRetrospective, true);
  const positive = { id: 'synthetic-positive', raw: 10,
    features: [{ p: .5, v: 100, d: 10, I: 20, count: 10, s: 8, r: 0, f: 0, L: 0 }] };
  assert.equal(proportionalAllocation(positive).passive, 10);
  // Historical ceil helper can return -0; the displayed numeric contribution is zero.
  assert.ok(proportionalAllocation(positive).board === 0);
  const boardOnly = { ...positive, features: [{ ...positive.features[0], s: 0, r: 8 }] };
  assert.ok(proportionalAllocation(boardOnly).passive === 0);
  assert.equal(proportionalAllocation(boardOnly).board, 10);
  for (const row of probe.featureRows) {
    const a = proportionalAllocation(row), b = proportionalAllocation({ ...row, features: [...row.features].reverse() });
    assert.equal(a.passive, b.passive);
    assert.equal(a.board, b.board);
    assert.ok(Math.abs(a.rawPassive + a.rawBoard - row.raw) < 1e-10);
  }
  assert.deepEqual(plan.boardOverrides, { 'chr-06002': { rate: 0, cooldown: 0 }, 'chr-00022': { rate: 23.5, cooldown: 0 } });
  assert.deepEqual(plan.hypotheses.proportionalAllocation, { passive: 2.3, board: 12.1, status: 'First future prediction of the new proportional family; not a confirmed general formula.' });
  assert.deepEqual(plan.observationsReceived, []);
  return { status: 'PASS', nextUnobserved: 'AP', baselineValues: plan.baselineValues,
    prospectivePrediction: { passive: 2.3, board: 12.1, jointCandidates: plan.hypotheses.joint.possibleDisplays },
    retrospectivePool: { completePairs: '20/24', unresolved: probe.summary.failures, generalFormulaConfirmed: false } };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyAPPlan(), null, 2));
