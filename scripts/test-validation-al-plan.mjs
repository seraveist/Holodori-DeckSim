import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAL } from '../analysis/unit-score/plan-passive-al-20260909.mjs';

const root = new URL('../', import.meta.url);
export function verifyALPlan() {
  const plan = JSON.parse(fs.readFileSync(new URL('analysis/unit-score/experiments/baseline-passive-AL-20260909.json', root), 'utf8'));
  assert.deepEqual(planAL(), plan, 'AL predictions or source inputs changed after freezing');
  assert.equal(plan.comparisonBase, 'AI');
  assert.equal(plan.control.AILeader.parameterCostumeActive, false);
  assert.equal(plan.control.ALLeader.parameterCostumeActive, true);
  assert.equal(plan.sourceContext.observations, 35);
  assert.equal(plan.sourceContext.activeAndSPMeasured, 34);
  assert.equal(plan.hypotheses.passive.display, 2.2);
  assert.equal(plan.hypotheses.board.display, 15.7);
  assert.deepEqual(plan.hypotheses.conditionalJoint.possibleDisplays, [17.8, 17.9]);
  assert.equal(plan.changedSlotsFromAK.length, 1);
  assert.equal(plan.changedSlotsFromAK[0].slot, 4);
  return { status: 'PASS', nextUnobserved: 'AL', comparisonBase: 'AI',
    baselineValues: plan.baselineValues, hypotheses: plan.hypotheses,
    note: 'Invariance predictions only; no AL measurement and no new allocation formula.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyALPlan(), null, 2));
