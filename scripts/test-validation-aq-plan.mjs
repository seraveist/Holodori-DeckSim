import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAQ } from '../analysis/unit-score/plan-rate-aq-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyAQPlan() {
  const plan = planAQ();
  assert.deepEqual(plan, read('analysis/unit-score/experiments/baseline-rate-AQ-20260909.json'));
  assert.equal(hash(plan.provenance.observationPath), plan.provenance.observationSHA256);
  assert.equal(hash(plan.provenance.reportPath), plan.provenance.reportSHA256);
  assert.deepEqual(plan.observationsReceived, []);
  const ap = read(plan.provenance.observationPath);
  for (const k of ['leaderId', 'memberIds', 'profiles']) assert.deepEqual(plan[k], ap[k]);
  assert.deepEqual(plan.boardOverrides, { 'chr-06002': { rate: 0, cooldown: 0 }, 'chr-00022': { rate: 21.5, cooldown: 0 } });
  const before = read('analysis/unit-score/reports/AP-comparison-20260909.json').features.features;
  for (let i = 0; i < before.length; i++) {
    const { r: oldRate, ...old } = before[i], { r: newRate, ...current } = plan.features.features[i];
    assert.deepEqual(current, old);
    assert.equal(oldRate - newRate, old.id === 'card-00022-5-uniq-0063-00' ? 2 : 0);
  }
  assert.equal(plan.hypotheses.finite200.passive, 2.4);
  assert.equal(plan.hypotheses.fractionalCount.passive, 2.3);
  assert.equal(plan.hypotheses.finite200.board, 12);
  assert.equal(plan.hypotheses.fractionalCount.board, 12);
  assert.deepEqual(plan.baselineValues, { memberParameter: 79007, outfitPower: 11859, passivePower: 7816, active: 75.2, special: 43.9 });
  assert.equal(plan.provenance.productionFormulaChanged, false);
  return { status: 'PASS', nextUnobserved: 'AQ', baselineValues: plan.baselineValues,
    finiteCount: { passive: 2.4, board: 12 }, fractionalCount: { passive: 2.3, board: 12 },
    requiredChange: 'From AP disable only Noel activation-rate2%; Kanade rate0 and Noel frequency0 remain.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyAQPlan(), null, 2));
