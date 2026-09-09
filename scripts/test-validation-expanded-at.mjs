import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { probeExpandedAT, expandedRows, selectedPrediction } from '../analysis/unit-score/probe-expanded-at-20260909.mjs';
import { leaderInterventionFeatures } from '../analysis/unit-score/plan-leader-at-20260909.mjs';
import { planAU } from '../analysis/unit-score/plan-judgment-au-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');

// Independent fixed-point implementation for the selected candidate.
// Probabilities are thousandths, support/value percentages are tenths.
// Window membership is compared as integers, without floating interval division.
function integerReference(row) {
  const integer = v => { assert.ok(Math.abs(v - Math.round(v)) < 1e-7); return Math.round(v); };
  const ceilDiv = (n, d) => { assert.ok(Number.isSafeInteger(n) && Number.isSafeInteger(d)); return Math.floor((n + d - 1) / d); };
  const result = {};
  for (const state of ['A', 'P', 'B', 'BP']) {
    const board = state.includes('B'), passive = state.includes('P');
    const members = row.features.map(m => {
      const p0 = integer(m.p * 1000), rate = integer(board ? m.r * 10 : 0);
      const value = integer(m.v * 10), support = integer(((board ? m.L : 0) + (passive ? m.s : 0)) * 10);
      return { p: Math.min(1000, ceilDiv(p0 * (1000 + rate), 1000)),
        v: ceilDiv(value * (1000 + support), 1000),
        interval: integer(m.I) * 1000, clock: 1000 + integer(board ? m.f * 10 : 0), duration: integer(m.d) };
    });
    let total = 0;
    for (let t = 1; t <= 200; t++) {
      let probability = 0, numerator = 0;
      for (const m of members) {
        const tick = t * m.clock;
        if (tick < m.interval) continue;
        const since = tick - Math.floor(tick / m.interval) * m.interval;
        if (since >= m.duration * m.clock) continue;
        probability += m.p;
        numerator += m.p * m.v;
      }
      total += numerator / (10 * Math.max(1000, probability)) / 200;
    }
    result[state] = total;
  }
  return result;
}

export function verifyExpandedAT() {
  const report = probeExpandedAT();
  assert.deepEqual(report, read('analysis/unit-score/reports/expanded-AT-20260909.json'));
  assert.equal(report.observations, 44);
  assert.equal(report.firstSearch.attempts, 31698);
  assert.equal(report.firstSearch.perfect.length, 4);
  assert.equal(report.secondSearch.attempts, 180);
  assert.equal(report.secondSearch.perfect.length, 1);
  assert.equal(report.selected.positiveMatches, 29);
  assert.equal(report.selected.zeroMatches, 11);
  assert.equal(report.selected.activeObserved, 36);
  assert.equal(report.selected.activeMatches, 36);
  assert.equal(report.evidence.prospectiveMeasurements, 0);
  assert.equal(report.evidence.allMatchesRetrospective, true);
  assert.equal(report.evidence.productionFormulaChanged, false);
  const rows = expandedRows().rows;
  for (const row of rows) {
    const actual = selectedPrediction(row), independent = integerReference(row);
    for (const key of ['A', 'P', 'B', 'BP']) assert.ok(Math.abs(actual.sums[key] - independent[key]) < 1e-8, `${row.id}/${key} integer reference mismatch`);
    assert.ok(actual.passiveMatches && actual.boardMatches);
    // Reversing member slots must not alter a generic unit-score display.
    const reversed = selectedPrediction({ ...row, features: [...row.features].reverse() });
    assert.equal(reversed.passive, actual.passive); assert.equal(reversed.board, actual.board);
  }
  const ar = report.selected.values.find(v => v.id === 'AR');
  const g = report.selected.values.find(v => v.id === 'G');
  assert.equal(ar.passive, 2.4); assert.equal(ar.board, 11.8); assert.equal(ar.roundedIncrement, 14.1);
  assert.equal(g.passive, 0); assert.equal(g.board, 13.8);
  assert.equal(report.selected.ablations.find(v => v.name === 'old endpoints only').pairs, 38);
  assert.equal(report.selected.ablations.find(v => v.name === 'value only').pairs, 39);
  const au = read('analysis/unit-score/experiments/AU-expanded-candidate-20260909.json'), originalPlan = planAU();
  assert.deepEqual(au.observationsReceived, []);
  assert.equal(hash(au.originalPlan), au.originalPlanSHA256);
  assert.equal(hash(au.provenance.source), au.provenance.sourceSHA256);
  assert.equal(hash('analysis/unit-score/expanded-kernel-at-20260909.mjs'), au.provenance.kernelSHA256);
  assert.equal(hash('analysis/unit-score/reports/expanded-AT-20260909.json'), au.provenance.reportSHA256);
  for (const key of ['leaderId', 'memberIds', 'profiles', 'boardOverrides', 'leaderSupportOverride', 'leaderJudgmentEnabled']) assert.deepEqual(au[key], originalPlan[key]);
  const prediction = selectedPrediction(leaderInterventionFeatures(originalPlan));
  assert.deepEqual(au.prediction, { passive: prediction.passive, board: prediction.board, active: prediction.active, special: originalPlan.baselineValues.special });
  assert.deepEqual(au.prediction, { passive: 3, board: 10.1, active: 75.2, special: 43.9 });
  return { status: 'PASS', numericBoardObservations: 40, positivePassivePairs: '29/29', zeroPassiveBoard: '11/11',
    activeObserved: '36/36 in this scope', integerReference: '40/40', prospectiveSuccesses: 0,
    exclusions: ['I', 'J', 'M', 'U'], productionFormulaChanged: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(verifyExpandedAT(), null, 2));
