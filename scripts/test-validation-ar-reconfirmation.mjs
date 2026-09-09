import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { probeRoundingATRecheck } from '../analysis/unit-score/probe-rounding-at-recheck-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyARReconfirmation() {
  const report = probeRoundingATRecheck();
  assert.deepEqual(report, read('analysis/unit-score/reports/rounding-AT-recheck-20260909.json'));
  const c = read(report.reconfirmation.path), original = read(c.originalObservation);
  assert.equal(hash(c.originalObservation), c.originalObservationSHA256);
  assert.equal(c.scope.countsAsNewSample, false);
  assert.equal(c.scope.otherScoreRowsReconfirmed, false);
  assert.equal(c.scope.profilesAndNodesSeparatelyAudited, false);
  assert.deepEqual(c.confirmedScoreBonusDetail, { board: 11.8, passive: 2.4 });
  for (const [key, value] of Object.entries(c.confirmedScoreBonusDetail)) assert.equal(original.game.scoreBonusDetail[key], value);
  assert.equal(report.catalogObservations, 44);
  assert.equal(report.eligiblePositivePassiveObservations, 29);
  assert.equal(report.search.attempts, 1098);
  assert.equal(report.search.perfect.length, 0);
  assert.equal(report.search.bestPairs, 28);
  assert.equal(report.search.bestVariants.length, 2);
  for (const v of report.search.bestVariants) {
    assert.deepEqual(v.failures, ['AR']);
    const failure = v.values.find(r => r.id === 'AR');
    assert.equal(failure.passive, 2.4); assert.equal(failure.board, 11.7);
    assert.equal(failure.observedBoard, 11.8);
  }
  const at = report.featureRows.find(r => r.id === 'AT');
  assert.ok(at.features.every(m => m.L === 10.2 && m.r === 0 && m.f === 0));
  assert.equal(report.evidence.allMatchesRetrospective, true);
  assert.equal(report.evidence.productionFormulaChanged, false);
  return { status: 'PASS', reconfirmed: 'AR', observationsUnchanged: 44, eligible: 29,
    searchedVariants: 1098, bestRetrospectivePairs: 28, remainingMismatch: 'AR board: predicted11.7, reconfirmed11.8; passive2.4 matches' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(verifyARReconfirmation(), null, 2));
