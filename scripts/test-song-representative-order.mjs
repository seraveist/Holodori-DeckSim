import assert from "node:assert/strict";
import fs from "node:fs";
import { prepareScoreCards } from "../js/card-prepare.js";
import { evaluateDeck } from "../js/score.js";
import { optimizeRecommendationOrders } from "../js/order.js";
import { runOptimization } from "../js/optimizer-core.js";

const read = name => JSON.parse(fs.readFileSync(new URL(`../data/generated/${name}.json`, import.meta.url), "utf8"));
const profiles = [
  ["card-06003-5-uniq-0059-00", 40, 0], // Ririka leader
  ["card-00026-5-uniq-0065-00", 70, 1], // Watame
  ["card-00018-5-uniq-0068-00", 60, 0], // Suisei
  ["card-00027-5-uniq-0022-00", 70, 0], // Towa
  ["card-06002-5-uniq-0066-00", 40, 0], // Kanade: confirmed current level
  ["card-06004-5-uniq-0060-00", 70, 1], // Raden
  ["card-00021-5-uniq-0064-00", 80, 1], // Flare for a second composition
];
const prepared = prepareScoreCards(read("cards"), new Map(read("characters").map(c => [c.id, c])),
  Object.fromEntries(profiles.map(([id, level, potential]) => [id, { level, potential }])),
  { masterRefs: read("master_refs"), levelMode: "current" });
const leader = prepared.get(profiles[0][0]);
const e = profiles.slice(1, 6).map(([id]) => prepared.get(id));
const d = [...e];
d[2] = prepared.get(profiles[6][0]);
const song = { ...read("music").find(m => m.id === "m0049"), _scoreRules: read("live-score-rules") };
const chart = read("chart-index").charts["m0049:EXPERT"];
const exact = { ...song, _chart: { ...chart, metadata: read("charts/m0049-EXPERT") } };
const master = { ...song, _chart: { ...chart, metadata: null } };
const permutations = xs => xs.length < 2 ? [xs] : xs.flatMap((x, i) =>
  permutations(xs.filter((_, j) => j !== i)).map(tail => [x, ...tail]));
const key = ids => `${ids[0]}:${ids.slice(1).toSorted().join("|")}`;
const metric = (score, target) => target === "potential" ? score.potentialRankingScore : score.rankingScore;

for (const [mode, selected] of [["exact", exact], ["master", master], ["estimated", song]]) {
  for (const playMode of ["auto", "manual"]) {
    const exhaustiveByKey = new Map([e, d].map(members => [key([leader.id, ...members.map(m => m.id)]),
      permutations(members).map(order => evaluateDeck({ leader, members: order, music: selected, playMode }))]));
    for (const simulationTarget of ["score", "potential"]) {
      // Feed two different orders for each of two compositions. The result must
      // contain one optimum per composition, not four rows or a one-row total.
      const results = [e, [...e].reverse(), d, [...d].reverse()].map(members => {
        const score = evaluateDeck({ leader, members, music: selected, playMode });
        return { members: [leader.id, ...members.map(m => m.id)], score, rankingValue: metric(score, simulationTarget) };
      });
      const recommendation = { ok: true, results };
      const before = structuredClone(recommendation);
      const optimized = optimizeRecommendationOrders({ recommendation, preparedCards: prepared,
        currentMembers: results[0].members, lockedSlots: Array(6).fill(true),
        music: selected, playMode, simulationTarget, resultCount: 5 });
      assert.equal(optimized.results.length, 2, `${mode}/${simulationTarget}: keep both unique compositions`);
      assert.equal(new Set(optimized.results.map(r => key(r.members))).size, 2);
      assert.equal(optimized.orderOptimization.evaluatedCount, 240, "Search duplicate compositions only once");
      assert.equal(optimized.orderOptimization.shortlistedCount, 2);
      assert.equal(optimized.orderOptimization.target, simulationTarget);
      assert.notEqual(optimized.orderOptimization.chartMode, "reference");
      for (const result of optimized.results) {
        const exhaustive = exhaustiveByKey.get(key(result.members));
        const maximum = Math.max(...exhaustive.map(score => metric(score, simulationTarget)));
        assert.equal(result.rankingValue, maximum, `${mode}/${playMode}/${simulationTarget}: representative must reach the exhaustive maximum`);
        assert.equal(metric(result.score, simulationTarget), maximum, "Final diagnostics evaluation must retain the winning score");
        assert.equal(result.orderEvaluation, undefined, "A real selected song must not use generic-order metadata");
        assert.equal(result.score.songProjection.context.chartAccuracy, mode);
        assert.deepEqual(result.score.diagnostics.map(row => row.cardId), result.members.slice(1));
        if (mode === "exact") {
          assert.equal(result.score.songProjection.specialWindows.length, 5);
          assert.deepEqual(result.score.songProjection.specialWindows.map(w => w.cardId), result.members.slice(1));
        }
      }
      assert.ok(optimized.results[0].rankingValue >= optimized.results[1].rankingValue);
      assert.deepEqual(recommendation, before, "Do not mutate source candidates");

      // Exercise the actual app/Worker entry point with all six cards preset.
      // Presets constrain membership; they must not disable SP order search.
      const ids = [leader.id, ...e.map(m => m.id)];
      const integrated = runOptimization({ preparedCards: prepared, ownedCardIds: ids,
        currentMembers: ids, lockedSlots: Array(6).fill(true),
        searchMusic: mode === "exact" ? master : selected, exactMusic: selected,
        playMode, simulationTarget, resultCount: 5 });
      assert.equal(integrated.results.length, 1);
      assert.equal(integrated.orderOptimization.evaluatedCount, 120);
      assert.equal(metric(integrated.score, simulationTarget),
        Math.max(...exhaustiveByKey.get(key(ids)).map(score => metric(score, simulationTarget))));
    }
    console.log(`selected-song representative: ${mode}/${playMode}, both targets, two unique compositions and exhaustive 120-order maxima OK`);
  }
}

// This measured-card fixture distinguishes the two goals: the best expected
// order is not also the best potential order on this chart.
const allExact = permutations(e).map(members => evaluateDeck({ leader, members, music: exact, playMode: "auto" }));
const highestExpected = Math.max(...allExact.map(s => s.rankingScore));
const highestPotential = Math.max(...allExact.map(s => s.potentialRankingScore));
assert.ok(!allExact.some(s => s.rankingScore === highestExpected && s.potentialRankingScore === highestPotential));
console.log("selected-song goal distinction: expected and potential maxima require different orders: OK");
