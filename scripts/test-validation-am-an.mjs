import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareAMAN, collectCatalog } from '../analysis/unit-score/compare-am-an-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');

export function verifyAMAN() {
  const state = read('analysis/unit-score/experiments/AM-AN-status-observed-20260909.json');
  for (const key of ['frozenPlan', 'report', 'catalog', 'analysisSource']) assert.equal(hash(state[key]), state[`${key}SHA256`], key);
  for (const file of [...state.observations, ...state.screenshots]) assert.equal(hash(file.path), file.sha256, file.path);
  assert.equal(state.frozenPlanSHA256, '0d9b0682ee9535d67ced1b7c3804db4c311adf066d4ae0af50f5a70a9daf2d19');
  const result = compareAMAN();
  assert.deepEqual(result, read(state.report));
  const entries = collectCatalog(state.catalog);
  assert.equal(entries.length, 38);
  assert.equal(new Set(entries.map(o => o.sampleId)).size, 38);
  assert.equal(new Set(entries.map(o => [...o.memberIds].sort().join(','))).size, 23);
  let powerCount = 0;
  for (const entry of entries) {
    assert.equal(hash(entry.sourcePath), entry.sourceSHA256);
    const source = read(entry.sourcePath);
    const observation = entry.initialFixtureIndex == null ? source : source.observations[entry.initialFixtureIndex];
    assert.deepEqual(entry.rawGame, observation.game);
    for (const key of ['leaderId', 'memberIds']) assert.deepEqual(entry[key], observation[key]);
    for (const key of ['memberParameter', 'outfit', 'passive']) if (entry.rawGame.powerDetail[key] != null) powerCount++;
  }
  assert.equal(powerCount, 97);
  for (const key of ['active', 'special']) assert.equal(entries.filter(o => o.rawGame.scoreBonusDetail[key] != null).length, 37);
  assert.deepEqual(read(state.catalog).summary, result.summary);
  const am = entries.find(o => o.sampleId === 'AM'), an = entries.find(o => o.sampleId === 'AN');
  assert.deepEqual([am.rawGame.overallPower, an.rawGame.overallPower], [132590, 128550]);
  assert.deepEqual([am.rawGame.scoreBonusPct, an.rawGame.scoreBonusPct], [129.4, 130.8]);
  assert.deepEqual([am.rawGame.scoreBonusDetail.passive, an.rawGame.scoreBonusDetail.passive], [1.7, 1.6]);
  assert.deepEqual([am.rawGame.scoreBonusDetail.board, an.rawGame.scoreBonusDetail.board], [9.4, 10.1]);
  assert.deepEqual([am.screenshot.attachmentIndex, an.screenshot.attachmentIndex], [1, 2]);
  for (const o of [am, an]) {
    assert.equal(o.rawGame.unitScore, null);
    assert.equal(o.rawGame.scoreBonusDetail.outfit, null);
    assert.equal(read(o.sourcePath).scoreRowPresence.outfit, false);
  }
  const ak = entries.find(o => o.sampleId === 'AK'), al = entries.find(o => o.sampleId === 'AL');
  assert.equal(ak.rawGame.scoreBonusDetail.active, null);
  assert.equal(ak.rawGame.scoreBonusDetail.special, null);
  assert.equal(al.rawGame.overallPower, null);
  assert.equal(al.rawGame.scoreBonusPct, null);
  assert.ok(result.rows.every(r => r.comparisons.every(c => c.matches)));
  assert.ok(result.rows.every(r => r.arithmetic.powerSumMatches && r.arithmetic.scoreRowsSumMatches && r.joint.compatible));
  assert.deepEqual(result.rows.map(r => r.joint.reportedSum), [11.1, 11.7]);
  assert.equal(result.summary.positivePassiveJointCompatibility, 23);
  assert.equal(result.frozenRelationshipTest.matches, false);
  assert.equal(result.frozenRelationshipTest.passiveDifference, 0);
  assert.equal(result.frozenRelationshipTest.observedPassiveDifference, -.1);
  assert.ok(read(state.frozenPlan).plans.every(p => p.passive === null && p.board === null));
  assert.equal(result.conditionalAllocation.marginalMultiplierIntersection.empty, true);
  assert.ok(result.conditionalAllocation.passiveRawDeltaInterval.max < 0);
  assert.equal(result.interpretation.generalAllocationFormulaConfirmed, false);
  assert.equal(result.interpretation.productionFormulaChanged, false);
  assert.equal(result.interpretation.nextPlan, null);
  return { status: 'PASS', latestObserved: 'AN', ...result.summary, nextUnobserved: [],
    AM: { passive: 1.7, board: 9.4, joint: 11.1 }, AN: { passive: 1.6, board: 10.1, joint: 11.7 },
    baselineValuesMatch: true, passiveInvarianceHypothesis: 'REJECTED (preserved, not a test failure)' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyAMAN(), null, 2));
