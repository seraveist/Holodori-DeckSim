import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareAO } from '../analysis/unit-score/compare-ao-20260909.mjs';
import { collectCatalog } from '../analysis/unit-score/compare-am-an-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyAO() {
  const state = read('analysis/unit-score/experiments/AO-status-observed-20260909.json');
  for (const key of ['frozenPlan', 'observation', 'report', 'catalog', 'analysisSource']) assert.equal(hash(state[key]), state[`${key}SHA256`]);
  const result = compareAO();
  assert.deepEqual(result, read(state.report));
  assert.equal(result.comparisons[0].matches, true);
  assert.equal(result.comparisons[1].matches, false);
  assert.equal(result.comparisons[2].compatible, true);
  const entries = collectCatalog(state.catalog);
  assert.equal(entries.length, 39);
  assert.equal(new Set(entries.map(o => o.sampleId)).size, 39);
  assert.equal(new Set(entries.map(o => [...o.memberIds].sort().join(','))).size, 23);
  assert.equal(entries.filter(o => o.rawGame.scoreBonusDetail.active != null).length, 37);
  assert.equal(entries.filter(o => o.rawGame.scoreBonusDetail.special != null).length, 37);
  const ao = entries.find(o => o.sampleId === 'AO');
  assert.deepEqual(ao.rawGame, result.observation.game);
  assert.deepEqual(ao.boardOverrides, { 'chr-06002': { rate: 0, cooldown: 0 } });
  for (const value of Object.values(ao.rawGame.powerDetail)) assert.equal(value, null);
  for (const key of ['unitScore', 'overallPower', 'scoreBonusPct']) assert.equal(ao.rawGame[key], null);
  assert.equal(ao.rawGame.scoreBonusDetail.active, null);
  assert.equal(ao.rawGame.scoreBonusDetail.special, null);
  assert.equal(result.summary.confirmedPowerComponents, 97);
  assert.equal(result.summary.positivePassiveJointCompatibility, 24);
  return { status: 'PASS', latestObserved: 'AO', ...result.summary, AO: { passive: 1.7, board: 9.4, derivedJoint: 11.1 },
    timingEquivalenceHypothesis: 'MATCHES', passiveInvarianceHypothesis: 'REJECTED', generalAllocationFormulaConfirmed: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyAO(), null, 2));
