import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAS } from '../analysis/unit-score/plan-no-timing-as-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
export function verifyASPlan() {
  const plan = planAS();
  assert.deepEqual(plan, read('analysis/unit-score/experiments/baseline-no-timing-AS-20260909.json'));
  assert.deepEqual(plan.observationsReceived, []);
  assert.ok(plan.features.features.every(m => m.r === 0 && m.f === 0 && m.L === 13.3));
  assert.deepEqual(plan.hypotheses.rawProportional, { passive: 3, board: 10.1 });
  assert.deepEqual(plan.hypotheses.directMarginal, { passive: 3, board: 10 });
  assert.deepEqual(plan.baselineValues, { memberParameter: 79007, outfitPower: 11859, passivePower: 7816, active: 75.2, special: 43.9 });
  const ar = read(plan.provenance.observationPath);
  for (const k of ['leaderId', 'memberIds', 'profiles']) assert.deepEqual(plan[k], ar[k]);
  assert.ok(Math.abs(plan.features.Braw - plan.features.Araw * 1.133) < 1e-9);
  assert.equal(plan.provenance.productionFormulaChanged, false);
  return { status: 'PASS', nextUnobserved: 'AS', baselineValues: plan.baselineValues,
    proportional: plan.hypotheses.rawProportional, directMarginal: plan.hypotheses.directMarginal,
    requiredChange: 'Noel and Flare remaining rate nodes OFF; Kanade rate and Noel frequency stayOFF; Ririka leader nodes unchanged.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyASPlan(), null, 2));
