import assert from "node:assert/strict";
import { evaluateDeck } from "../js/score.js";

const leader = (support = 0) => ({
  id: "leader", characterId: "leader",
  leader: { primaryCondition: [], additionalCondition: [], primaryEffects: { support }, additionalEffects: {} },
});
const member = (id, score = 100) => ({
  id, characterId: id, characterName: id, attribute: 1, groupings: new Set(),
  stats: { p: 1000, t: 1000, s: 1000 },
  profile: { level: 80, potential: 0 }, passive: null,
  active: { interval: 10, duration: 10, probability: score ? 1 : 0, baseScoreUp: score, conditionalScoreUp: score, condition: null },
  special: { duration: 0, support: 0, activationRateUp: 0, condition: null },
});
const members = ["A", "B", "C", "D", "E"].map(id => member(id));
members[0].special = { duration: 11, support: 100, activationRateUp: 0, condition: null };
members[1].passive = { condition: null, effect: { kind: "support", value: 5, target: { kind: "all", count: 5 } } };
const unit = evaluateDeck({ leader: leader(20), members });
// 100% Active × (1 + 20% outfit + 5% passive + 10% average SP) = 135%.
// Multiplying the 10% SP by the existing 125% incorrectly produces 137.5%.
assert.deepEqual(unit.detail.scoreBonus, { outfit: 20, active: 100, board: 0, passive: 5, special: 10 });
assert.equal(unit.scoreBonusPct, 135);
assert.equal(unit.potentialScoreBonusPct, 135);

const music = { id: "support-addition", playing_seconds: 110, live_score_coefficient_permil: 5 };
const aggregate = evaluateDeck({ leader: leader(20), members, music });
// The aggregate path excludes the first 10 seconds before the initial check.
const aggregateMultiplier = 1 + 1.35 * 100 / 110;
assert.ok(Math.abs(aggregate.songProjection.expected.skillMultiplier - aggregateMultiplier) < 1e-12,
  "Aggregate song support must add SP to static support before averaging");
assert.ok(Math.abs(aggregate.songProjection.maximum.skillMultiplier - aggregateMultiplier) < 1e-12);

const exactMusic = { ...music, _chart: { chartHash: "support-addition-exact", fullComboNoteCount: 3,
  metadata: { notes: [["tap", 12], ["tap", 15], ["tap", 19]], skills: [{ slot: 1, time: 10, combo: 0 }], fever: null } } };
const exact = evaluateDeck({ leader: leader(20), members, music: exactMusic });
// At these note times the whole 100% SP is active: 100 × (1 + .20 + .05 + 1).
assert.ok(Math.abs(exact.songProjection.expected.skillMultiplier - 3.25) < 1e-12);
assert.ok(Math.abs(exact.songProjection.maximum.skillMultiplier - 3.25) < 1e-12);

// Adding the same SP support to everyone can change which Active is strongest.
const crossing = [member("A", 100), member("B", 125), ...["C", "D", "E"].map(id => member(id, 0))];
crossing[0].passive = { condition: null, effect: { kind: "support", value: 30, target: { kind: "self", count: 1 } } };
for (const m of crossing) m.special = { duration: 11, support: 120, activationRateUp: 0, condition: null };
const reranked = evaluateDeck({ leader: leader(), members: crossing });
// A: 100 × (1 + .30 + .60) = 190; B: 125 × (1 + .60) = 200.
assert.equal(reranked.scoreBonusPct, 200);
assert.equal(reranked.detail.scoreBonus.special, 70);

// Passive attribution must use the leader-supported competition. Without a
// leader A reaches 130 and beats B's 125, adding 5. With +60% leader support,
// A reaches 190 while B reaches 200, so A's passive contributes no marginal
// gain. Freezing the no-leader passive at 5 would misattribute that gain.
const leaderCompetition = [member("P", 100), member("Q", 125), ...["R", "S", "T"].map(id => member(id, 0))];
leaderCompetition[0].passive = { condition: null, effect: { kind: "support", value: 30, target: { kind: "self", count: 1 } } };
const noLeaderSupport = evaluateDeck({ leader: leader(), members: leaderCompetition });
const withLeaderSupport = evaluateDeck({ leader: leader(60), members: leaderCompetition });
assert.equal(noLeaderSupport.detail.scoreBonus.passive, 5);
assert.equal(withLeaderSupport.detail.scoreBonus.passive, 0);
assert.deepEqual(withLeaderSupport.detail.scoreBonus, { outfit: 75, active: 125, board: 0, passive: 0, special: 0 });
assert.equal(withLeaderSupport.scoreBonusPct, 200);
assert.equal(withLeaderSupport.potentialScoreBonusPct, 200);
console.log("support stacking: additive sources, SP winner change, leader-aware Passive attribution: OK");
