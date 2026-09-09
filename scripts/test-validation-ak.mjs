import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareAK } from '../analysis/unit-score/compare-passive-ak-20260909.mjs';

const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');

export function verifyAK() {
  const state = read('analysis/unit-score/experiments/AK-status-observed-20260909.json');
  for (const field of ['frozenPlan', 'observation', 'analysisSource', 'report', 'catalog']) {
    assert.equal(hash(state[field]), state[`${field}SHA256`], field);
  }
  const result = compareAK();
  assert.deepEqual(result, read(state.report));
  assert.deepEqual(result.comparisons.map(c => [c.item, c.observed, c.matches]), [
    ['passive', 1.5, true], ['board', 12.2, true]
  ]);
  assert.equal(result.jointComparison.derivedSum, 13.7);
  assert.equal(result.jointComparison.compatible, true);
  assert.equal(result.summary.observations, 35);
  assert.equal(result.summary.distinctMemberSets, 21);
  assert.equal(result.summary.activeObserved, 34);
  assert.equal(result.summary.spObserved, 34);
  assert.equal(result.summary.activeMatches, 34);
  assert.equal(result.summary.spMatches, 34);
  assert.equal(result.summary.positivePassiveJointCompatibility, 20);
  assert.equal(result.diagnosticOnly.individualBoardMatches, false);
  assert.equal(state.result.baselineFiveValuesMatch, null);
  assert.equal(state.next, null);
  const catalog = read(state.catalog), parent = read(catalog.extendsCatalog);
  assert.equal(hash(catalog.extendsCatalog), catalog.extendsCatalogSHA256);
  assert.equal(parent.observations.length, 34);
  assert.equal(catalog.observations.length, 1);
  const entry = catalog.observations[0];
  assert.deepEqual(entry.rawGame, result.observation.game);
  assert.deepEqual(entry.confirmedByReference, result.observation.confirmedByReference);
  assert.equal(entry.sourceSHA256, hash(state.observation));
  assert.equal(entry.research.activeMatches, null);
  assert.equal(entry.research.specialMatches, null);
  assert.equal(entry.sampleId, 'AK');
  assert.ok(!parent.observations.some(o => o.sampleId === 'AK'));
  assert.deepEqual(catalog.summary, result.summary);
  return { status: 'PASS', latestObserved: 'AK', AKStatus: 'Passive and board confirmed; other values unreported',
    ...result.summary, AK: { passive: 1.5, board: 12.2, derivedJoint: 13.7, bothFrozenPredictionsMatch: true } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyAK(), null, 2));
