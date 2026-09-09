import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareALAndPlanPair } from '../analysis/unit-score/compare-al-plan-am-an-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyAL() {
  const state = read('analysis/unit-score/experiments/AL-status-observed-20260909.json');
  for (const key of ['frozenPlan', 'observation', 'report', 'catalog', 'nextPlan', 'analysisSource']) assert.equal(hash(state[key]), state[`${key}SHA256`], key);
  const result = compareALAndPlanPair();
  assert.deepEqual(result, read(state.report));
  assert.deepEqual({ ...result.next, provenance: result.provenance }, read(state.nextPlan));
  const collect = p => {
    const c = read(p);
    if (!c.extendsCatalog) return c.observations;
    assert.equal(hash(c.extendsCatalog), c.extendsCatalogSHA256);
    return [...collect(c.extendsCatalog), ...c.observations];
  };
  const entries = collect(state.catalog);
  assert.equal(entries.length, 36);
  assert.equal(new Set(entries.map(o => o.sampleId)).size, 36);
  assert.ok(!entries.some(o => ['AM', 'AN'].includes(o.sampleId)));
  let powerCount = 0;
  for (const entry of entries) {
    assert.equal(hash(entry.sourcePath), entry.sourceSHA256);
    const source = read(entry.sourcePath);
    const observation = entry.initialFixtureIndex == null ? source : source.observations[entry.initialFixtureIndex];
    assert.deepEqual(entry.rawGame, observation.game);
    for (const key of ['memberParameter', 'outfit', 'passive']) if (entry.rawGame.powerDetail[key] != null) powerCount++;
  }
  assert.equal(powerCount, 91);
  assert.equal(new Set(entries.map(o => [...o.memberIds].sort().join(','))).size, 21);
  assert.equal(entries.filter(o => o.rawGame.scoreBonusDetail.active != null).length, 35);
  assert.equal(entries.filter(o => o.rawGame.scoreBonusDetail.special != null).length, 35);
  const ak = entries.find(o => o.sampleId === 'AK'), al = entries.find(o => o.sampleId === 'AL');
  assert.equal(ak.rawGame.scoreBonusDetail.active, null);
  assert.equal(ak.rawGame.scoreBonusDetail.special, null);
  assert.equal(al.rawGame.overallPower, null);
  assert.equal(al.rawGame.scoreBonusPct, null);
  assert.equal(al.rawGame.unitScore, null);
  assert.equal(al.rawGame.scoreBonusDetail.passive, 2.2);
  assert.equal(al.rawGame.scoreBonusDetail.board, 15.7);
  assert.equal(result.summary.positivePassiveJointCompatibility, 21);
  assert.deepEqual(result.next.plans.map(p => p.conditionalJoint.possibleDisplays), [[11.1, 11.2], [11.7, 11.8]]);
  assert.ok(result.next.plans.every(p => p.passive === null && p.board === null));
  return { status: 'PASS', latestObserved: 'AL', ...result.summary, nextUnobserved: ['AM', 'AN'],
    AL: { passive: 2.2, board: 15.7, derivedJoint: 17.9, sevenConfirmedValuesMatch: true },
    upcomingPlans: result.next.plans.map(p => ({ id: p.sampleId, baseline: p.baselineValues, conditionalJoint: p.conditionalJoint.possibleDisplays })) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyAL(), null, 2));
