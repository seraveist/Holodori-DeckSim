import assert from "node:assert/strict";
import { evaluateDeck } from "../js/score.js";

const leader = {
  id: "leader", characterId: "leader",
  leader: { primaryCondition: [], additionalCondition: [], primaryEffects: {}, additionalEffects: {} },
};
const makeMember = (id, stats, passive = null, groups = []) => ({
  id, characterId: id, attribute: 1, groupings: new Set(groups), stats, passive,
  active: { interval: 30, probability: 0, duration: 0, baseScoreUp: 0 },
  special: { duration: 0, support: 0, activationRateUp: 0 },
});
const sensePassive = {
  condition: null,
  effect: { kind: "stat", stat: "s", value: 32, target: { kind: "group", value: "regloss", count: 2 } },
};

// In-game observation 2026-09-08: Raden and Kanade each give the same two
// ReGLOSS members +32% Sense. Their base Sense values are 9237 and 10132;
// the game displays a combined Passive Power contribution of 12397.
const members = [
  makeMember("raden", { p: 6235, t: 5521, s: 9237 }, sensePassive, ["regloss"]),
  makeMember("kanade", { p: 7116, t: 6315, s: 10132 }, sensePassive, ["regloss"]),
  makeMember("watame", { p: 5640, t: 6355, s: 9049 }),
  makeMember("noel", { p: 10132, t: 6315, s: 7116 }),
  makeMember("flare", { p: 7116, t: 10132, s: 6315 }),
];
const observed = evaluateDeck({ leader, members });
assert.equal(observed.detail.power.memberParameter, 112726);
assert.equal(observed.detail.power.passive, 12397,
  "Overlapping passive percentages must be combined per member and stat before rounding up");
assert.deepEqual(observed.deckStats, { p: 36239, t: 34638, s: 54246 });

// All-stat and single-stat passives share the same stat bucket. Inactive
// passives must not enter that bucket, and the target count must be respected.
const all = { condition: null, effect: { kind: "all", value: 10, target: { kind: "all", count: 5 } } };
const one = { condition: null, effect: { kind: "stat", stat: "p", value: 10, target: { kind: "all", count: 1 } } };
const disabled = { condition: { kind: "attribute", value: 2, count: 1 }, effect: { kind: "all", value: 100, target: { kind: "all", count: 5 } } };
const mixed = Array.from({ length: 5 }, (_, i) => makeMember(`m${i}`, { p: 1001, t: 1001, s: 1001 }, [all, one, disabled][i] ?? null));
assert.equal(evaluateDeck({ leader, members: mixed }).detail.power.passive, 1615);
console.log("passive stat rounding: observed ReGLOSS overlap and mixed-target regressions OK");
