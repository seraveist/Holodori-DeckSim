import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compareAW } from '../analysis/unit-score/compare-aw-20260909.mjs';
import { planAY } from '../analysis/unit-score/plan-watame-ay-20260909.mjs';
import { collectCatalog } from '../analysis/unit-score/compare-am-an-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyAW() {
  const state = read('analysis/unit-score/experiments/AW-status-observed-20260909.json');
  for (const [key, digest] of [['observationPath', 'observationSHA256'], ['report', 'reportSHA256'], ['catalog', 'catalogSHA256']]) assert.equal(hash(state[key]), state[digest]);
  const r = compareAW(); assert.deepEqual(r, read(state.report));
  assert.equal(r.comparisons.length, 4); assert.ok(r.comparisons.every(v => v.matches));
  assert.deepEqual(r.selectedCandidate.prospectivePairs, { measured: 1, matches: 1, ids: ['AW'] });
  assert.ok(r.alternatives.find(c => c.name === 'denominator rounding only').boardMatches);
  assert.equal(r.alternatives.find(c => c.name === 'value rounding only').boardMatches, false);
  for (const value of Object.values(r.observation.game.powerDetail)) assert.equal(value, null);
  for (const key of ['unitScore', 'overallPower', 'scoreBonusPct']) assert.equal(r.observation.game[key], null);
  const entries = collectCatalog(state.catalog);
  assert.equal(entries.length, 45); assert.equal(new Set(entries.map(e => e.sampleId)).size, 45);
  assert.equal(new Set(entries.map(e => [...e.memberIds].sort().join(','))).size, 24);
  assert.ok(!entries.some(e => ['AV', 'AX', 'AU', 'AY'].includes(e.sampleId)));
  assert.equal(r.summary.activeMatches, 41); assert.equal(r.summary.spMatches, 41);
  assert.equal(r.summary.confirmedPowerComponents, 106);
  const ay = planAY(); assert.deepEqual(ay, read('analysis/unit-score/experiments/baseline-watame-AY-20260909.json'));
  assert.equal(hash(ay.provenance.baseline), ay.provenance.baselineSHA256);
  for (const key of ['leaderId', 'memberIds', 'profiles']) assert.deepEqual(ay[key], r.observation[key]);
  assert.deepEqual(ay.boardOverrides['chr-00026'], { rate: 0, cooldown: 0 });
  for (const [id, value] of Object.entries(r.observation.boardOverrides)) if (id !== 'chr-00026') assert.deepEqual(ay.boardOverrides[id], value);
  assert.deepEqual(ay.observationsReceived, []);
  assert.deepEqual(ay.prediction, { active: 74, special: 42.9, passive: 7, board: 12 });
  assert.equal(ay.productionFormulaChanged, false);
  return { status: 'PASS', latestObserved: 'AW', ...r.summary,
    expandedCandidate: { retrospective: '40/40 through AT', prospective: '1/1: AW' },
    nextUnobserved: { sampleId: 'AY', ...ay.prediction }, otherUnobserved: ['AV', 'AX', 'AU'] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(verifyAW(), null, 2));
