import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compareAVAXAY } from '../analysis/unit-score/compare-av-ax-ay-20260909.mjs';
import { planAZ } from '../analysis/unit-score/plan-ax-noel-off-az-20260909.mjs';
import { collectCatalog } from '../analysis/unit-score/compare-am-an-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyAVAXAY() {
  const state = read('analysis/unit-score/experiments/AV-AX-AY-status-observed-20260909.json');
  for (const [path, digest] of [['report', 'reportSHA256'], ['catalog', 'catalogSHA256'], ['nextPlan', 'nextPlanSHA256']]) assert.equal(hash(state[path]), state[digest]);
  for (const [path, digest] of Object.entries(state.observationHashes)) assert.equal(hash(path), digest);
  const r = compareAVAXAY(); assert.deepEqual(r, read(state.report));
  assert.equal(r.selectedCandidate.combinedMatches, 43); assert.equal(r.selectedCandidate.combinedEligiblePairs, 44);
  assert.equal(r.selectedCandidate.prospective.matches, 3); assert.equal(r.selectedCandidate.prospective.pairs, 4);
  assert.deepEqual(r.results.filter(v => !v.pairMatches).map(v => v.sampleId), ['AX']);
  const ax = r.observations.find(o => o.sampleId === 'AX');
  assert.equal(ax.game.scoreBonusDetail.passive, null); assert.equal(ax.scoreRowPresence.passive, false);
  assert.equal(ax.initialReply.scoreBonusDetail.active, null); assert.equal(ax.initialReply.scoreBonusDetail.special, null);
  assert.equal(ax.game.scoreBonusDetail.active, 68.9); assert.equal(ax.game.scoreBonusDetail.special, 37.5);
  assert.equal(ax.boardInputsConfirmedByUser, true); assert.equal(ax.profilesConfirmed, false);
  const axComparison = r.results.find(v => v.sampleId === 'AX').comparisons;
  assert.equal(axComparison.find(v => v.key === 'passive').normalizedAbsentRow, true);
  assert.deepEqual(axComparison.filter(v => !v.matches).map(v => v.key), ['board']);
  for (const o of r.observations) {
    assert.ok(Object.values(o.game.powerDetail).every(v => v === null));
    for (const key of ['unitScore', 'overallPower', 'scoreBonusPct']) assert.equal(o.game[key], null);
  }
  const entries = collectCatalog(state.catalog);
  assert.equal(entries.length, 48); assert.equal(new Set(entries.map(e => e.sampleId)).size, 48);
  assert.equal(new Set(entries.map(e => [...e.memberIds].sort().join(','))).size, 26);
  assert.ok(!entries.some(e => ['AU', 'AZ'].includes(e.sampleId)));
  assert.deepEqual(read(state.catalog).summary, r.summary);
  for (const key of ['activeObserved', 'activeMatches', 'spObserved', 'spMatches']) assert.equal(r.summary[key], 44);
  assert.equal(r.summary.confirmedPowerComponents, 106); assert.equal(r.summary.positivePassiveJointCompatibility, 32);
  assert.equal(r.diagnostics.roundingAudit.settings, 12);
  assert.equal(Math.max(...r.diagnostics.roundingAudit.variants.map(v => v.matches)), 43);
  const mixed = r.diagnostics.roundingAudit.variants.find(v => v.config.endpoints?.board === 'ceil' && v.config.endpoints.active === 'floor');
  assert.equal(mixed.AX.board, 10.9); assert.equal(mixed.matches, 1);
  assert.ok(r.diagnostics.AX.boardAppliedIncreaseNeededWithFixedActiveEndpoint > .09);
  const az = planAZ(); assert.deepEqual(az, read(state.nextPlan));
  assert.deepEqual(az.prediction, { active: 68.9, special: 37.5, passive: 0, board: 9.2 });
  assert.deepEqual(az.observationsReceived, []);
  for (const key of ['leaderId', 'memberIds', 'profiles']) assert.deepEqual(az[key], ax[key]);
  for (const [id, value] of Object.entries(ax.boardOverrides)) assert.deepEqual(az.boardOverrides[id], id === 'chr-00022' ? { rate: 0, cooldown: 0 } : value);
  assert.equal(az.leaderSupportOverride, 13.3); assert.equal(az.leaderJudgmentRequested, true);
  assert.equal(hash(az.provenance.source), az.provenance.sourceSHA256);
  for (const [path, digest] of Object.entries(az.provenance.sourceHashes)) assert.equal(hash(path), digest);
  return { status: 'PASS', meaning: 'Observation/provenance reproduction passed; AX model mismatch is intentionally preserved.', latestObserved: r.latestObserved,
    ...r.summary, expandedCandidate: { retrospective: '40/40 through AT', prospective: '3/4: AV/AW/AY match, AX board mismatch', combined: '43/44 eligible pairs, not a statistical accuracy estimate' },
    nextUnobserved: { sampleId: 'AZ', ...az.prediction }, otherUnobserved: ['AU'] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(verifyAVAXAY(), null, 2));
