import { writeResult } from './io.mjs';
import assert from 'node:assert/strict';
import { teams, integrate, round1, specialGains, permutationValues, kernel } from './dummy-model-lab.mjs';
import { probeActiveReference } from './unit-active-reference.mjs';

const baseTeams = teams.filter(t => !['I', 'J'].includes(t.id));
const displayMatches = (value, target, rounding = 'ceil') => Math.abs(round1(value, rounding) - target) < 1e-9;
for (const team of baseTeams.filter(t => t.id !== 'H')) assert.ok(Math.abs(integrate(team) - probeActiveReference(team.members).raw) < 1e-9);

// All grids declared in advance here. A/C are the original calibration cases;
// every other row is reported as a retrospective check, not new held-out data.
const activeVariants = [];
for (const aggregation of ['weighted', 'maximum']) {
  for (const step of [0.1, 0.5, 1, 2]) for (const samplePhase of [0, 0.5, 1]) {
    for (const rounding of ['floor', 'round', 'ceil']) {
      const raw = baseTeams.map(t => integrate(t, { aggregation, step, samplePhase }));
      const values = raw.map(x => round1(x, rounding));
      activeVariants.push({ aggregation, step, samplePhase, rounding, values,
        matches: values.filter((x, i) => displayMatches(x, baseTeams[i].game.active)).length });
    }
  }
}
const phaseVariants = [];
for (const firstImmediate of [false, true]) for (const offset of [-3, -2, -1, 0, 1, 2, 3]) {
  const values = baseTeams.map(t => round1(integrate(t, { offset, firstImmediate })));
  phaseVariants.push({ firstImmediate, offset, values,
    matches: values.filter((v, i) => displayMatches(v, baseTeams[i].game.active)).length });
}

// Independent comparison of each skill category. No per-card coefficients.
const passive = teams.map(t => ({ id: t.id, observed: t.game.passive ?? 0,
  rawNoBoard: integrate(t, { passive: true }) - integrate(t),
  rawWithOutfit: integrate(t, { passive: true, outfit: t.outfit }) - integrate(t, { outfit: t.outfit }),
  boardVariants: ['raw', 'floor', 'round', 'ceil'].map(cooldownRounding => ({ cooldownRounding,
    raw: integrate(t, { passive: true, board: true, cooldownRounding, outfit: t.outfit + t.leaderBoardSupport })
      - integrate(t, { board: true, cooldownRounding, outfit: t.outfit + t.leaderBoardSupport }) })) }));
const outfit = teams.filter(t => t.outfit).map(t => ({ id: t.id, observed: t.game.outfit,
  variants: ['raw', 'floor', 'round', 'ceil'].map(cooldownRounding => ({ cooldownRounding,
    noBoard: integrate(t, { outfit: t.outfit }) - integrate(t),
    withBoard: integrate(t, { outfit: t.outfit, board: true, cooldownRounding }) - integrate(t, { board: true, cooldownRounding }) })) }));

const specialVariants = [];
// 20+5*? Fixed equal-spacing grids; keep all five windows inside 200s.
for (const probabilityTiming of ['instant', 'check']) for (const passive of [false, true]) {
  for (const start of [0, 10, 20, 30, 200 / 6]) for (const gap of [25, 30, 200 / 6, 35, 40]) {
    if (start + gap * 4 + 14 > 200) continue;
    const starts = Array.from({ length: 5 }, (_, i) => start + i * gap);
    const results = baseTeams.map(t => {
      const matrix = specialGains(t, starts, { probabilityTiming, passive });
      const values = permutationValues(matrix);
      return { id: t.id, observed: t.game.special, currentOrder: matrix.reduce((s, row, i) => s + row[i], 0),
        mean: values.reduce((s, v) => s + v, 0) / values.length, min: Math.min(...values), max: Math.max(...values) };
    });
    const error = results.reduce((s, r) => s + Math.abs(r.mean - r.observed), 0) / results.length;
    const acError = results.slice(0, 2).reduce((s, r) => s + Math.abs(r.mean - r.observed), 0) / 2;
    specialVariants.push({ probabilityTiming, passive, starts, error, acError, results });
  }
}
specialVariants.sort((a, b) => a.acError - b.acError);
// Bound an order-averaged independent-window model even when each SP may
// choose its own ideal start. This is an upper bound for any fixed five slots
// under the same additive model; it does not assume a real song has such slots.
const specialBounds = baseTeams.map(t => {
  const startTimes = Array.from({ length: 201 }, (_, i) => i);
  const gains = specialGains(t, startTimes);
  return { id: t.id, observed: t.game.special, maxSumOfIndividualWindows: gains.reduce((s, row) => s + Math.max(...row), 0),
    uniformStartAverage: gains.reduce((s, row) => s + row.reduce((a, v) => a + v, 0) / row.length, 0) };
});
const report = { recordedAt: new Date().toISOString(), status: 'Exploratory grid on existing observations; no production integration',
  activeVariants, phaseVariants, passive, outfit, specialVariants, specialBounds };
writeResult('dummy-environment-probes.json', report);
console.log(JSON.stringify({ activeMatches: activeVariants.filter(v => v.matches === 6), phaseMatches: phaseVariants.filter(v => v.matches === 6),
  passive, outfit, specialBestAC: specialVariants.slice(0, 2), specialBestAll: [...specialVariants].sort((a,b)=>a.error-b.error).slice(0,2), specialBounds }, null, 2));
