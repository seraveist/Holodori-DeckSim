import { writeResult, sourceLock } from './io.mjs';
import assert from 'node:assert/strict';
import { teams, integrate, round1 } from './dummy-model-lab.mjs';

// A retrospective diagnostic only. No production calibration is applied.
const before = sourceLock();
const base = teams.filter(t => !['I', 'J'].includes(t.id));

function solve(rows) {
  const n = rows[0].x.length;
  const m = Array.from({ length: n }, (_, i) => Array.from({ length: n + 1 }, (_, j) =>
    rows.reduce((s, r) => s + r.x[i] * (j === n ? r.y : r.x[j]), 0)));
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(m[i][k]) > Math.abs(m[pivot][k])) pivot = i;
    [m[k], m[pivot]] = [m[pivot], m[k]];
    assert.ok(Math.abs(m[k][k]) > 1e-14, 'Fit must be identifiable in this dataset');
    const d = m[k][k];
    for (let j = k; j <= n; j++) m[k][j] /= d;
    for (let i = 0; i < n; i++) if (i !== k) {
      const f = m[i][k];
      for (let j = k; j <= n; j++) m[i][j] -= f * m[k][j];
    }
  }
  return m.map(r => r[n]);
}
const predict = (r, c) => r.x.reduce((s, x, i) => s + x * c[i], 0);
function residuals(rows, coefficients) {
  const values = rows.map(r => ({ ...r, prediction: predict(r, coefficients),
    ceilDisplay: round1(predict(r, coefficients)), error: predict(r, coefficients) - r.y }));
  return { values, meanAbsErrorPp: values.reduce((s, r) => s + Math.abs(r.error), 0) / rows.length,
    maxAbsErrorPp: Math.max(...values.map(r => Math.abs(r.error))),
    ceilDisplayMatches: values.filter(r => r.ceilDisplay === r.y).length };
}
function fit(rows, leaveOneOut = true) {
  const coefficients = solve(rows);
  return { coefficients, training: residuals(rows, coefficients),
    ...(leaveOneOut && rows.length > rows[0].x.length ? { leaveOneOut: rows.map((r, i) => {
      const c = solve(rows.filter((_, j) => i !== j));
      return { id: r.id, coefficients: c, ...residuals([r], c).values[0] };
    }) } : {}) };
}
function singleConstantIntervals(rows) {
  return ['ceil', 'round', 'floor'].map(mode => {
    const ranges = rows.filter(r => r.x[0] > 1e-10).map(r => {
      const low = r.y - (mode === 'ceil' ? 0.1 : mode === 'round' ? 0.05 : 0);
      const high = r.y + (mode === 'floor' ? 0.1 : mode === 'round' ? 0.05 : 0);
      return { id: r.id, min: low / r.x[0], max: high / r.x[0] };
    });
    const min = Math.max(...ranges.map(r => r.min)), max = Math.min(...ranges.map(r => r.max));
    return { mode, ranges, min, max, commonCoefficientExists: min < max };
  });
}

function twoConstantFeasibility(rows) {
  // Eliminate the second coefficient from every lower/upper interval pair.
  // Coefficients may be any real values, not just positive values.
  assert.ok(rows.every(r => r.x.length === 2 && r.x[1] > 0));
  return ['ceil', 'round', 'floor'].map(mode => {
    const ranges = rows.map(r => ({
      lo: r.y - (mode === 'ceil' ? 0.1 : mode === 'round' ? 0.05 : 0),
      hi: r.y + (mode === 'floor' ? 0.1 : mode === 'round' ? 0.05 : 0),
      a: r.x[0], b: r.x[1],
    }));
    let min = -Infinity, max = Infinity, impossible = false;
    for (const lower of ranges) for (const upper of ranges) {
      const slope = upper.a / upper.b - lower.a / lower.b;
      const limit = upper.hi / upper.b - lower.lo / lower.b;
      if (Math.abs(slope) < 1e-12) { if (limit < -1e-12) impossible = true; }
      else if (slope > 0) max = Math.min(max, limit / slope);
      else min = Math.max(min, limit / slope);
    }
    return { mode, firstCoefficientMin: min, firstCoefficientMax: max,
      feasibleEvenWithClosedRoundingBounds: !impossible && min <= max };
  });
}

// Historical observation JSONs encode omitted G/I categories as zero.
// Those screens are not positive measurements for fitting residual statistics.
const passiveRows = teams.filter(t => t.game.passive > 0).map(t => ({
  id: t.id, x: [integrate(t, { passive: true }) - integrate(t)], y: t.game.passive,
}));
const passiveLeaderRows = passiveRows.map(r => ({ ...r,
  x: [r.x[0], r.x[0] * teams.find(t => t.id === r.id).outfit / 100] }));
const outfitRows = teams.filter(t => t.outfit).map(t => ({
  id: t.id, x: [integrate(t) * t.outfit / 100], y: t.game.outfit,
}));
const spParts = base.map(t => {
  const baseline = integrate(t);
  let supportNumerator = 0, rateNumerator = 0;
  for (const m of t.members) {
    const sp = { ...m.special, duration: 201 };
    const rateOnly = integrate(t, { sp: { ...sp, support: 0 }, spStart: 0 });
    const both = integrate(t, { sp, spStart: 0 });
    rateNumerator += (rateOnly - baseline) * m.special.duration;
    supportNumerator += (both - rateOnly) * m.special.duration;
  }
  return { id: t.id, x: [supportNumerator / 200, rateNumerator / 200], y: t.game.special };
});
const spSingleRows = spParts.map(r => ({ ...r, x: [r.x[0] + r.x[1]] }));
const acCoefficients = solve(spParts.filter(r => ['A', 'C'].includes(r.id)));
const spTwo = fit(spParts);
const result = {
  recordedAt: new Date().toISOString(),
  revision: 2,
  supersedes: 'fixed-constant-fits-20260909.json: omitted G/I passive categories excluded from fit statistics in this revision; coefficients are unchanged',
  scope: 'Retrospective fits using existing observations, not new out-of-sample game validation. Inputs use the analysis-only 200-second weighted Active model; displayed board contribution is excluded but indirect board effects are not proven absent.',
  passive: { definition: 'k * mean marginal Active support from passive; zero omitted categories are not treated as measured exact zeros',
    single: fit(passiveRows), intervals: singleConstantIntervals(passiveRows),
    leaderInteractionDiagnostic: { definition: 'k1 * passive marginal + k2 * passive marginal * leader outfit support / 100',
      validationLimit: 'J is the only positive-passive observation with nonzero outfit support. Removing J makes the interaction coefficient unidentifiable.',
      ...fit(passiveLeaderRows, false) } },
  outfit: { definition: 'k * raw Active mean * leader outfit support / 100',
    single: fit(outfitRows), intervals: singleConstantIntervals(outfitRows),
    twoParameterCaution: 'Only two nonzero outfit observations, both the same 60% support leader. An affine two-coefficient fit has no remaining validation data.' },
  special: { definition: 'For each SP, compute its whole-window average marginal Active gain and multiply by duration; divide total by 200. Two components separate probability-only gain and support gain including probability interaction.',
    single: fit(spSingleRows), intervals: singleConstantIntervals(spSingleRows),
    separateSupportAndRate: spTwo,
    twoCoefficientFeasibility: twoConstantFeasibility(spParts),
    retrospectiveACSplit: { trainedOn: ['A', 'C'], coefficients: acCoefficients,
      evaluation: residuals(spParts.filter(r => !['A', 'C'].includes(r.id)), acCoefficients) } },
  sourceHashes: before,
};
for (const category of ['passive', 'outfit', 'special']) assert.ok(result[category].intervals.every(r => !r.commonCoefficientExists));
assert.ok(result.special.twoCoefficientFeasibility.every(r => !r.feasibleEvenWithClosedRoundingBounds));
const e = passiveRows.find(r => r.id === 'E'), j = passiveRows.find(r => r.id === 'J');
assert.ok(Math.abs(e.x[0] - j.x[0]) < 1e-10);
assert.notEqual(e.y, j.y);
assert.deepEqual(sourceLock(), before);
writeResult('fixed-constant-fits-20260909-v2.json', result);
console.log(JSON.stringify({
  passive: result.passive, outfit: result.outfit, special: result.special,
  historicalSourcesAndProductionUnchanged: true,
}, null, 2));
