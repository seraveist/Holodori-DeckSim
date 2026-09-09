import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planAT, leaderInterventionFeatures } from '../analysis/unit-score/plan-leader-at-20260909.mjs';
import { allocationFeatures } from '../analysis/unit-score/probe-proportional-allocation-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyATPlan() {
  const p = planAT(); assert.deepEqual(p, read('analysis/unit-score/experiments/baseline-leader-AT-20260909.json'));
  assert.equal(hash(p.provenance.observationPath), p.provenance.observationSHA256);
  assert.equal(hash(p.provenance.precedingReport), p.provenance.precedingReportSHA256);
  assert.deepEqual(p.observationsReceived, []); assert.equal(p.leaderSupportOverride, 10.2);
  assert.ok(p.features.features.every(m => m.r === 0 && m.f === 0 && m.L === 10.2));
  assert.deepEqual(p.hypotheses.rawProportional, { passive: 3, board: 7.8 });
  assert.deepEqual(p.hypotheses.directMarginal, { passive: 3, board: 7.7 });
  const as = read(p.provenance.observationPath);
  for (const k of ['leaderId', 'memberIds', 'profiles', 'boardOverrides']) assert.deepEqual(p[k], as[k]);
  // Resetting the new override to the prior value must reproduce the existing adapter exactly.
  assert.deepEqual(leaderInterventionFeatures({ ...as, leaderSupportOverride: 13.3 }), allocationFeatures(as));
  const zero = leaderInterventionFeatures({ ...as, leaderSupportOverride: 0 });
  assert.ok(Math.abs(zero.Braw - zero.Araw) < 1e-10);
  assert.ok(Math.abs((p.features.BPraw - p.features.Braw) - (zero.BPraw - zero.Braw)) < 1e-9);
  assert.equal(p.provenance.productionFormulaChanged, false);
  return { status: 'PASS', nextUnobserved: 'AT', rawProportional: p.hypotheses.rawProportional,
    directMarginal: p.hypotheses.directMarginal, requiredChange: 'AS baseline retained; only Ririka score-support3.1% OFF, if independently possible.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyATPlan(), null, 2));
