import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compareAZ } from '../analysis/unit-score/compare-az-20260909.mjs';
import { collectCatalog } from '../analysis/unit-score/compare-am-an-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyAZ() {
  const s = read('analysis/unit-score/experiments/AZ-status-observed-20260909.json');
  for (const [path, digest] of [['report', 'reportSHA256'], ['catalog', 'catalogSHA256'], ['observationPath', 'observationSHA256']]) assert.equal(hash(s[path]), s[digest]);
  const r = compareAZ(); assert.deepEqual(r, read(s.report));
  assert.ok(r.comparisons.every(c => c.matches)); assert.equal(r.comparisons.length, 4);
  assert.equal(r.observation.game.scoreBonusDetail.passive, null); assert.equal(r.observation.scoreRowPresence.passive, false);
  assert.equal(r.comparisons.find(c => c.key === 'passive').normalizedAbsentRow, true);
  assert.ok(Object.values(r.observation.game.powerDetail).every(v => v === null));
  for (const key of ['unitScore', 'overallPower', 'scoreBonusPct']) assert.equal(r.observation.game[key], null);
  assert.equal(r.selectedCandidate.prospective.pairs, 5); assert.equal(r.selectedCandidate.prospective.matches, 4);
  assert.deepEqual(r.selectedCandidate.prospective.failures, ['AX']);
  assert.equal(r.selectedCandidate.combinedEligiblePairs, 45); assert.equal(r.selectedCandidate.combinedMatches, 44);
  assert.equal(r.pairedIntervention.observedBoardIncrease, 1.7); assert.equal(r.pairedIntervention.predictedBoardIncrease, 1.6);
  const entries = collectCatalog(s.catalog);
  assert.equal(entries.length, 49); assert.equal(new Set(entries.map(e => e.sampleId)).size, 49);
  assert.equal(new Set(entries.map(e => [...e.memberIds].sort().join(','))).size, 26);
  assert.ok(!entries.some(e => e.sampleId === 'AU'));
  for (const key of ['activeObserved', 'activeMatches', 'spObserved', 'spMatches']) assert.equal(r.summary[key], 45);
  assert.equal(r.summary.confirmedPowerComponents, 106); assert.equal(r.summary.positivePassiveJointCompatibility, 32);
  assert.deepEqual(read(s.catalog).summary, r.summary);
  assert.equal(r.selectedCandidate.promotedToProduction, false);
  return { status: 'PASS', meaning: 'Recorded observations and frozen forecasts reproduce; AX remains a model mismatch.', latestObserved: 'AZ', ...r.summary,
    expandedCandidate: { retrospective: '40/40 through AT', prospective: '4/5: AV/AW/AY/AZ match; AX board10.8 versus10.9', combined: '44/45 eligible pairs; not statistical accuracy' },
    nextResearch: r.interpretation.nextResearch, unobserved: ['AU'] };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(verifyAZ(), null, 2));
