import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareAT } from '../analysis/unit-score/compare-at-20260909.mjs';
import { planAU } from '../analysis/unit-score/plan-judgment-au-20260909.mjs';
import { collectCatalog } from '../analysis/unit-score/compare-am-an-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyAT() {
  const state = read('analysis/unit-score/experiments/AT-status-observed-20260909.json');
  for (const k of ['frozenPlan', 'observation', 'report', 'catalog', 'analysisSource']) assert.equal(hash(state[k]), state[`${k}SHA256`]);
  const r = compareAT(); assert.deepEqual(r, read(state.report));
  assert.equal(r.comparisons.rawProportional.matches, false); assert.equal(r.comparisons.directMarginal.matches, true);
  assert.equal(r.joint.observed, 10.7); assert.ok(r.joint.compatible);
  const entries = collectCatalog(state.catalog);
  assert.equal(entries.length, 44); assert.equal(new Set(entries.map(o => o.sampleId)).size, 44);
  assert.equal(new Set(entries.map(o => [...o.memberIds].sort().join(','))).size, 23);
  for (const k of ['active', 'special']) assert.equal(entries.filter(o => o.rawGame.scoreBonusDetail[k] != null).length, 40);
  const at = entries.find(o => o.sampleId === 'AT'); assert.deepEqual(at.rawGame, r.observation.game);
  assert.equal(at.leaderSupportOverride, 10.2);
  assert.ok(r.features.features.every(m => m.r === 0 && m.f === 0 && m.L === 10.2));
  for (const v of Object.values(at.rawGame.powerDetail)) assert.equal(v, null);
  for (const k of ['unitScore', 'overallPower', 'scoreBonusPct']) assert.equal(at.rawGame[k], null);
  assert.equal(at.rawGame.scoreBonusDetail.active, null); assert.equal(at.rawGame.scoreBonusDetail.special, null);
  assert.equal(r.summary.confirmedPowerComponents, 106); assert.equal(r.summary.positivePassiveJointCompatibility, 29);
  const interval = r.diagnostic.hypotheticalCommonAdditionalBoardContribution;
  assert.ok(interval.lowerExclusive > 0 && interval.upperInclusive < .04 && interval.feasible);
  assert.equal(r.interpretation.productionFormulaChanged, false);
  return { status: 'PASS', latestObserved: 'AT', ...r.summary, AT: { passive: 3, board: 7.7, rawProportional: 'REJECTED_IN_THIS_CONTROL' } };
}
export function verifyAUPlan() {
  const p = planAU(); assert.deepEqual(p, read('analysis/unit-score/experiments/baseline-judgment-AU-20260909.json'));
  for (const pair of [['baselinePath', 'baselineSHA256'], ['predecessorPath', 'predecessorSHA256'], ['boardRecord', 'boardRecordSHA256'], ['reportPath', 'reportSHA256']]) assert.equal(hash(p.provenance[pair[0]]), p.provenance[pair[1]]);
  assert.deepEqual(p.observationsReceived, []); assert.equal(p.leaderSupportOverride, 13.3); assert.equal(p.leaderJudgmentEnabled, false);
  const as = read(p.provenance.baselinePath);
  for (const k of ['leaderId', 'memberIds', 'profiles', 'boardOverrides']) assert.deepEqual(p[k], as[k]);
  assert.equal(p.hypotheses.judgmentExplainsASExtraBoard.board, 10);
  assert.equal(p.hypotheses.unchangedAfterJudgmentOff.board, 10.1);
  return { status: 'PASS', nextUnobserved: 'AU', conditionalJudgmentPrediction: { passive: 3, board: 10 },
    unchangedPrediction: { passive: 3, board: 10.1 }, requiredChange: 'Restore Ririka support3.1%, then disable only judgment conversion; compare with AS.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify({ ...verifyAT(), nextPlan: verifyAUPlan() }, null, 2));
