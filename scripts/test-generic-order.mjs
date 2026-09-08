import assert from "node:assert/strict";
import { evaluateDeck } from "../js/score.js";
import { optimizeRecommendationOrders } from "../js/order.js";
import { ORDER_REFERENCE, ORDER_REFERENCE_MUSIC } from "../js/order-reference.js";
import { runOptimization } from "../js/optimizer-core.js";

const leader = { id: "L", characterId: "L", characterName: "L", leader: {
  primaryCondition: [], primaryEffects: {}, additionalCondition: [], additionalEffects: {},
} };
const member = id => ({
  id, characterId: id, characterName: id, attribute: 1, groupings: new Set(),
  profile: { level: 80, potential: 0 }, stats: { p: 1000, t: 1000, s: 1000 }, passive: null,
  active: { interval: 20, duration: 10, probability: 1, baseScoreUp: 100, conditionalScoreUp: 100, condition: null },
  special: { duration: 10, support: 0, activationRateUp: 0, condition: null },
});
const members = ["A", "B", "C", "D", "Z"].map(member);
members[4].special = { duration: 10, support: 120, activationRateUp: 0, condition: null };
const cards = new Map([leader, ...members].map(c => [c.id, c]));
const original = evaluateDeck({ leader, members });
const row = order => ({ members: [leader.id, ...order.map(m => m.id)],
  score: evaluateDeck({ leader, members: order }), rankingValue: original.rankingScore });
const input = { ok: true, results: [row(members), row([...members].reverse())] };
const snapshot = structuredClone(input);
const permutations = xs => xs.length < 2 ? [xs] : xs.flatMap((x, i) =>
  permutations(xs.filter((_, j) => i !== j)).map(tail => [x, ...tail]));
// Independently evaluate every order through the production chart engine.
const exhaustive = permutations(members).map(order => ({ order,
  score: evaluateDeck({ leader, members: order, music: ORDER_REFERENCE_MUSIC, evaluationTarget: "potential" }),
}));
const bestPotential = Math.max(...exhaustive.map(r => r.score.potentialRankingScore));
const worstPotential = Math.min(...exhaustive.map(r => r.score.potentialRankingScore));
assert.ok(bestPotential > worstPotential, "This fixture must distinguish SP placement");
assert.equal(ORDER_REFERENCE_MUSIC._chart.metadata.notes.length, 800);
assert.equal(ORDER_REFERENCE.specialTimes.length, 5);
assert.ok(ORDER_REFERENCE.specialTimes.every((t, i) => Math.abs(t - (i + 1) * 110 / 6) < 1e-9));

for (const simulationTarget of ["score", "potential"]) {
  const optimized = optimizeRecommendationOrders({ recommendation: input, preparedCards: cards,
    currentMembers: ["L", ...members.map(m => m.id)], lockedSlots: Array(6).fill(true),
    music: null, simulationTarget, resultCount: 5 });
  assert.equal(optimized.results.length, 1, "A composition must occupy only one result");
  assert.equal(optimized.orderOptimization.evaluatedCount, 120, "Deduplicate before searching orders");
  assert.equal(optimized.orderOptimization.chartMode, "reference");
  assert.equal(optimized.orderOptimization.target, "potential", "Both generic goals use potential for representative order");
  const best = optimized.results[0];
  assert.equal(best.members[0], "L");
  assert.equal(best.members[1], "Z", "The strongest SP belongs in the best-supported window, despite its preset slot");
  assert.deepEqual(new Set(best.members.slice(1)), new Set(members.map(m => m.id)));
  assert.equal(best.orderEvaluation.potentialScore, bestPotential);
  assert.equal(best.orderEvaluation.specialWindows.length, 5);
  assert.deepEqual(best.orderEvaluation.specialWindows.map(w => w.cardId), best.members.slice(1));
  assert.equal(best.score.unitScore, original.unitScore, "Keep the calibrated Unit Score separate from the order reference");
  assert.equal(best.score.potentialUnitScore, original.potentialUnitScore);
  assert.equal(best.score.songProjection, null, "Do not expose an assumed chart as a selected real song");
  assert.equal(best.rankingValue, simulationTarget === "potential" ? original.potentialUnitScore : original.unitScore);
  assert.deepEqual(best.score.diagnostics.map(d => d.cardId), best.members.slice(1));
  assert.equal("_orderPotential" in best, false);
  assert.equal("_preparedComposition" in best, false);

  const reversedInput = { ...input, results: [...input.results].reverse() };
  const rerun = optimizeRecommendationOrders({ recommendation: reversedInput, preparedCards: cards, music: null, simulationTarget });
  assert.deepEqual(rerun.members, optimized.members, "Equal-potential ties must not depend on input order");

  const integrated = runOptimization({ preparedCards: cards, ownedCardIds: [...cards.keys()],
    currentMembers: ["L", ...members.map(m => m.id)], lockedSlots: Array(6).fill(true),
    simulationTarget, resultCount: 5 });
  assert.equal(integrated.ok, true);
  assert.deepEqual(integrated.members, optimized.members, "The worker's entry point must apply generic order optimization");
  assert.equal(integrated.results.length, 1);
}
assert.deepEqual(input, snapshot, "Order search must not mutate the input recommendation");

// Same members with a different leader are distinct units, not duplicates.
const secondLeader = { ...leader, id: "L2", characterId: "L2" };
cards.set(secondLeader.id, secondLeader);
const separate = optimizeRecommendationOrders({ recommendation: { ok: true, results: [
  row(members), { ...row(members), members: ["L2", ...members.map(m => m.id)] },
] }, preparedCards: cards, music: null, resultCount: 5 });
assert.equal(separate.results.length, 2);
assert.equal(separate.orderOptimization.evaluatedCount, 240);

// No SP effect: all orders tie and still produce exactly one deterministic row.
const noSpCards = new Map([...cards].map(([id, c]) => [id, c.active
  ? { ...c, special: { duration: 0, support: 0, activationRateUp: 0 } } : c]));
const tied = optimizeRecommendationOrders({ recommendation: input, preparedCards: noSpCards, music: null });
assert.equal(tied.results.length, 1);
assert.deepEqual(tied.members.slice(1), ["A", "B", "C", "D", "Z"]);
console.log(`generic representative order: both goals, 120 orders, deduplication, presets, stable ties and integration OK (${worstPotential} -> ${bestPotential})`);
