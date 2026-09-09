import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fixture, prepared } from '../analysis/unit-score/validation-data.mjs';
import { teams, integrate, round1 } from '../analysis/unit-score/dummy-model-lab.mjs';
import { predictNext } from '../analysis/unit-score/predict-next.mjs';
import { probeActiveReference } from '../analysis/unit-score/unit-active-reference.mjs';
import { makeTemplate, compareObservation } from '../analysis/unit-score/experiment.mjs';
const read = name => JSON.parse(fs.readFileSync(new URL(`../analysis/unit-score/${name}`, import.meta.url), 'utf8'));
const frozen = read('archive/next-predictions-20260909.json');
const next = predictNext();
assert.equal(read('validation-cards.import.json').ownedCards.length, 11);
assert.deepEqual(read('validation-cards.import.json').ownedCards, fixture.profiles);
assert.equal(read('archive/inferred-unit-environment-20260909.json').active.physicalTickSeconds, null);
for (const t of teams.filter(t => !['I', 'J'].includes(t.id))) {
  assert.equal(round1(integrate(t)), t.game.active, `${t.id}: Active candidate drift`);
  if (t.id !== 'H') assert.ok(Math.abs(integrate(t) - probeActiveReference(t.members).raw) < 1e-8);
}
const close = (a, b, label) => {
  if (typeof a === 'number' && typeof b === 'number') assert.ok(Math.abs(a - b) < 1e-8, `${label}: ${a} != ${b}`);
  else if (a && b && typeof a === 'object' && typeof b === 'object') {
    assert.deepEqual(Object.keys(a), Object.keys(b), label);
    for (const key of Object.keys(a)) close(a[key], b[key], `${label}.${key}`);
  } else assert.equal(a, b, label);
};
close(next.predictions, frozen.predictions, 'frozen next predictions');
for (const p of next.predictions) {
  assert.equal(new Set([p.leaderId, ...p.memberIds].map(id => prepared.get(id).characterId)).size, 6);
  assert.equal(p.profiles.length, 6);
  assert.ok(p.profiles.every(Boolean));
}
// L isolates leader scaling with the same members as I, and no support passive.
assert.equal(next.predictions[0].research.inputs.outfitSupport, 25);
assert.equal(next.predictions[0].research.inputs.passiveMarginal, 0);
assert.equal(next.predictions[1].research.inputs.outfitSupport, 60);
const fixed = read('archive/fixed-constant-fits-20260909-v2.json');
for (const category of ['passive', 'outfit', 'special']) assert.ok(fixed[category].intervals.every(r => !r.commonCoefficientExists));
assert.ok(fixed.special.twoCoefficientFeasibility.every(r => !r.feasibleEvenWithClosedRoundingBounds));
// Synthetic parser checks are never stored or counted as in-game observations.
const template = makeTemplate('L');
assert.throws(() => compareObservation(template), /Confirm the actual/);
const synthetic = { ...template, profilesConfirmed: true, observedAt: 'synthetic-test', boardContext: 'unknown (synthetic)',
  game: { unitScore: null, overallPower: 110, scoreBonusPct: 12,
    powerDetail: { memberParameter: 100, outfit: null, board: 10, passive: null, memory: null, enhancement: null },
    scoreBonusDetail: { outfit: null, active: 10, board: 2, passive: null, special: null } } };
assert.equal(compareObservation(synthetic).retainedPower, 100);
assert.equal(compareObservation(synthetic).differences.specialTwoCoefficients.rawErrorPp, null);
assert.throws(() => compareObservation({ ...synthetic, game: { ...synthetic.game, overallPower: 111 } }), /Power components/);
console.log('scoring handoff: portable profiles, 6 Active observations, and 3 initial experiment predictions preserved; unknown bonus formula remains a hypothesis');
