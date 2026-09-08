import { writeResult } from './io.mjs';
import assert from 'node:assert/strict';
import { teams, integrate, kernel, condition, specialGains, round1, boards } from './dummy-model-lab.mjs';
const base = teams.filter(t => !['I', 'J'].includes(t.id));

const h = teams.find(t => t.id === 'H');
const comboSweep = Array.from({ length: 1561 }, (_, i) => i + 40).map(notes => ({ notes,
  value: round1(integrate(h, { comboMode: 'timeline', notes })) }));
const matches = comboSweep.filter(r => r.value === h.game.active);
assert.equal(matches[0].notes, 308);
assert.equal(matches.at(-1).notes, 1600);
assert.equal(matches.length, 1600 - 308 + 1);

const spGlobal = [];
for (const probabilityBoost of ['relative', 'absolute']) for (const passive of [false, true]) {
  const rows = base.map(t => {
    const original = integrate(t, { passive });
    let numerator = 0;
    for (const m of t.members) {
      const boosted = integrate(t, { passive, probabilityBoost, sp: { ...m.special, duration: 201 }, spStart: 0 });
      numerator += (boosted - original) * m.special.duration;
    }
    const observed = t.game.special;
    // ceil(numerator / denominator, 0.1) == observed means a half-open
    // interval [numerator/observed, numerator/(observed - 0.1)).
    return { id: t.id, observed, numerator, fixed200: round1(numerator / 200),
      denominatorRange: { inclusiveMin: numerator / observed, exclusiveMax: numerator / (observed - 0.1) } };
  });
  const min = Math.max(...rows.map(r => r.denominatorRange.inclusiveMin));
  const max = Math.min(...rows.map(r => r.denominatorRange.exclusiveMax));
  const roundingIntersections = ['ceil', 'round', 'floor'].map(rounding => {
    const ranges = rows.map(r => {
      const lowTarget = r.observed - (rounding === 'ceil' ? 0.1 : rounding === 'round' ? 0.05 : 0);
      const highTarget = r.observed + (rounding === 'floor' ? 0.1 : rounding === 'round' ? 0.05 : 0);
      return { min: r.numerator / highTarget, max: r.numerator / lowTarget };
    });
    const lo = Math.max(...ranges.map(r => r.min)), hi = Math.min(...ranges.map(r => r.max));
    return { rounding, min: lo, max: hi, commonDenominatorExists: lo < hi };
  });
  spGlobal.push({ probabilityBoost, passive, rows, commonDenominatorExists: min < max, intersection: { min, max }, roundingIntersections });
}

const spWindowBounds = [];
for (const probabilityTiming of ['instant', 'check']) for (const probabilityBoost of ['relative', 'absolute']) {
  for (const passive of [false, true]) {
    const rows = base.map(t => {
      const gains = specialGains(t, Array.from({ length: 201 }, (_, i) => i), { probabilityTiming, probabilityBoost, passive });
      const bound = gains.reduce((sum, row) => sum + Math.max(...row), 0);
      return { id: t.id, observed: t.game.special, sumIndividualMaxima: bound,
        canReach: bound > t.game.special - 0.1,
        starts: gains.map(row => row.indexOf(Math.max(...row))) };
    });
    spWindowBounds.push({ probabilityTiming, probabilityBoost, passive, rows,
      allCanReach: rows.every(r => r.canReach) });
  }
}

const outfitVariants = [];
for (const aggregation of ['weighted', 'maximum']) for (const mode of ['none', 'rate', 'cooldown', 'both']) {
  for (const rounding of ['raw', 'floor', 'round', 'ceil']) {
    const rows = teams.filter(t => t.outfit).map(t => {
      const modified = { ...t, members: t.members.map(m => {
        const b = boards.get(m.characterId);
        return { ...m, active: { ...m.active,
          probability: ['rate', 'both'].includes(mode) ? Math.min(1, m.active.probability * (1 + b.rate / 100)) : m.active.probability,
          interval: ['cooldown', 'both'].includes(mode) ? m.active.interval * (1 - b.cooldown / 100) : m.active.interval,
        } };
      }) };
      const value = integrate(modified, { aggregation, cooldownRounding: rounding }) * t.outfit / 100;
      return { id: t.id, observed: t.game.outfit, raw: value, display: round1(value) };
    });
    outfitVariants.push({ aggregation, mode, rounding, rows, matches: rows.filter(r => r.display === r.observed).length });
  }
}
const result = { recordedAt: new Date().toISOString(), status: 'Retrospective candidate rejection and conditional bounds; not a validated whole-score model',
  combo: { assumptions: 'H only, 200 seconds, uniform note progression, combo maintained, checked at each activation. Always-met combo needs no such note-count constraint.',
    searched: [40, 1600], matchingNotes: [matches[0].notes, matches.at(-1).notes], lowerNeighbor: comboSweep.find(r=>r.notes===307), firstMatch:matches[0],
    note: 'This lower bound does not imply the game uses uniform notes, maintains combo or contains 800 notes. No upper bound was identified.' },
  spGlobal, spWindowBounds, outfitVariants };
writeResult('dummy-identifiability-probes.json', result);
console.log(JSON.stringify({ combo: result.combo, spGlobal: spGlobal.map(v=>({...v,rows:v.rows.map(r=>({id:r.id,observed:r.observed,fixed200:r.fixed200,denominatorRange:r.denominatorRange}))})),
  spWindowBounds:spWindowBounds.map(v=>({...v,rows:v.rows.map(r=>({id:r.id,observed:r.observed,bound:r.sumIndividualMaxima,canReach:r.canReach}))})),
  matchingOutfits:outfitVariants.filter(v=>v.matches>0), allOutfitMatchCount:outfitVariants.filter(v=>v.matches===2).length }, null, 2));
