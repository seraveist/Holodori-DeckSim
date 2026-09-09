import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareAR } from '../analysis/unit-score/compare-ar-20260909.mjs';
import { collectCatalog } from '../analysis/unit-score/compare-am-an-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyAR() {
  const state = read('analysis/unit-score/experiments/AR-status-observed-20260909.json');
  for (const key of ['frozenPlan', 'observation', 'screenshot', 'report', 'catalog', 'analysisSource']) assert.equal(hash(state[key]), state[`${key}SHA256`]);
  const result = compareAR();
  assert.deepEqual(result, read(state.report));
  assert.ok(result.baselineComparisons.every(v => v.matches));
  assert.equal(result.frozenHypotheses.roundedFractional.pairMatches, false);
  assert.equal(result.frozenHypotheses.rawFractional.pairMatches, true);
  assert.ok(result.structuralRejection.impossibleAtAnyAllocationRatio);
  assert.equal(result.structuralRejection.maximumTwoCeilDisplaySum, 14.1);
  assert.equal(result.structuralRejection.observedDisplaySum, 14.2);
  assert.ok(result.joint.compatible);
  assert.equal(result.arithmetic.visiblePowerSum, result.arithmetic.reportedPower);
  assert.equal(result.arithmetic.visibleScoreSum, result.arithmetic.reportedScore);
  const entries = collectCatalog(state.catalog);
  assert.equal(entries.length, 42);
  assert.equal(new Set(entries.map(o => o.sampleId)).size, 42);
  assert.equal(new Set(entries.map(o => [...o.memberIds].sort().join(','))).size, 23);
  for (const key of ['active', 'special']) assert.equal(entries.filter(o => o.rawGame.scoreBonusDetail[key] != null).length, 40);
  const ar = entries.find(o => o.sampleId === 'AR');
  assert.deepEqual(ar.rawGame, result.observation.game);
  assert.deepEqual(ar.boardOverrides, { 'chr-06002': { rate: 0, cooldown: 0 }, 'chr-00022': { rate: 17.8, cooldown: 0 } });
  assert.equal(ar.rawGame.unitScore, null);
  assert.equal(ar.rawGame.scoreBonusDetail.outfit, null);
  assert.equal(result.summary.confirmedPowerComponents, 106);
  assert.equal(result.summary.positivePassiveJointCompatibility, 27);
  assert.equal(result.summary.activeMatches, 40); assert.equal(result.summary.spMatches, 40);
  assert.equal(result.interpretation.productionFormulaChanged, false);
  return { status: 'PASS', latestObserved: 'AR', ...result.summary,
    AR: { passive: 2.4, board: 11.8, roundedIncrementPrediction: 'REJECTED', rawAlternative: 'MATCHES_THIS_CONTROL' },
    roundedFormulaProspectivePairs: '0/1', next: 'AS no member timing board baseline' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyAR(), null, 2));
