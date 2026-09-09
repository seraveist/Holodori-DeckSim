import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAR } from '../analysis/unit-score/plan-rounded-ar-20260909.mjs';
import { planARRevised } from '../analysis/unit-score/plan-rounded-ar-revised-20260909.mjs';
import { probeRoundedAllocation, roundedAllocation } from '../analysis/unit-score/probe-rounded-allocation-aq-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyARPlan() {
  const plan = planAR(), probe = probeRoundedAllocation();
  assert.deepEqual(plan, read('analysis/unit-score/experiments/baseline-rounded-AR-20260909.json'));
  assert.deepEqual(probe, read(plan.provenance.probeReport));
  assert.equal(hash(plan.provenance.probeReport), plan.provenance.probeReportSHA256);
  assert.equal(hash(plan.provenance.observationPath), plan.provenance.observationSHA256);
  assert.deepEqual(plan.observationsReceived, []);
  assert.equal(probe.eligibleObservations, 26);
  assert.deepEqual(probe.summary, { pairs: 26, passive: 26, board: 26, failures: [] });
  assert.equal(probe.search.attempts, 120);
  assert.equal(probe.search.perfect.length, 2);
  assert.equal(probe.evidence.allRetrospective, true);
  assert.equal(probe.evidence.prospectiveObservations, 0);
  assert.equal(probe.evidence.productionFormulaChanged, false);
  assert.deepEqual(probe.ablations.originalFiniteRawIncrement.failures, ['W', 'AA', 'AF', 'AH', 'AQ']);
  for (const row of probe.featureRows) {
    const a = roundedAllocation(row), b = roundedAllocation({ ...row, features: [...row.features].reverse() });
    assert.equal(a.passive, b.passive); assert.equal(a.board, b.board);
    assert.ok(Math.abs(a.rawPassive + a.rawBoard - a.roundedIncrement) < 1e-10);
    const scaled = roundedAllocation({ ...row, features: row.features.map(m => ({ ...m, I: m.I * 2 })) });
    assert.equal(a.passive, scaled.passive); assert.equal(a.board, scaled.board);
  }
  const synthetic = { id: 'synthetic', Araw: 1, BPraw: 2.04,
    features: [{ p: .5, v: 100, d: 10, I: 20, s: 10, r: 10, f: 0, L: 0 }] };
  const s = roundedAllocation(synthetic);
  assert.equal(s.roundedIncrement, 1.1);
  assert.equal(s.passive, .6); assert.equal(s.board, .6);
  assert.deepEqual(plan.boardOverrides, { 'chr-06002': { rate: 0, cooldown: 0 }, 'chr-00022': { rate: 14.1, cooldown: 0 } });
  const aq = read(plan.provenance.observationPath);
  for (const key of ['leaderId', 'memberIds', 'profiles']) assert.deepEqual(plan[key], aq[key]);
  assert.deepEqual(plan.hypotheses.roundedFractional, { passive: 2.5, board: 11.4, roundedIncrement: 13.8 });
  assert.deepEqual(plan.hypotheses.rawFractional, { passive: 2.5, board: 11.5 });
  assert.equal(plan.hypotheses.predictedVisibleScoreTotal, 133);
  const revised = planARRevised();
  assert.deepEqual(revised, read('analysis/unit-score/experiments/baseline-rounded-AR-revised-20260909.json'));
  assert.equal(hash(revised.provenance.constraintPath), revised.provenance.constraintSHA256);
  assert.equal(hash(revised.provenance.originalPlan), revised.provenance.originalPlanSHA256);
  assert.equal(revised.revision, 2);
  assert.deepEqual(revised.observationsReceived, []);
  assert.deepEqual(revised.boardOverrides, { 'chr-06002': { rate: 0, cooldown: 0 }, 'chr-00022': { rate: 17.8, cooldown: 0 } });
  assert.deepEqual(revised.hypotheses.roundedFractional, { passive: 2.4, board: 11.7, roundedIncrement: 14 });
  assert.deepEqual(revised.hypotheses.rawFractional, { passive: 2.4, board: 11.8 });
  assert.equal(revised.hypotheses.predictedVisibleScoreTotal, 133.2);
  return { status: 'PASS', nextUnobserved: 'AR', revision: 2, originalPlan: 'SUPERSEDED_WITHOUT_MEASUREMENT', retrospectivePairs: '26/26', prospectiveObservations: 0,
    roundedPrediction: { passive: 2.4, board: 11.7 }, rawPrediction: { passive: 2.4, board: 11.8 },
    requiredChange: 'From AQ disable only the independently removable Noel3.7% rate node; retain17.8%, Noel frequencyOFF and Kanade ratesOFF.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyARPlan(), null, 2));
