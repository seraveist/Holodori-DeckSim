import assert from "node:assert/strict";
import fs from "node:fs";
import { prepareScoreCards } from "../js/card-prepare.js";
import { evaluateDeck, prepareDeckComposition } from "../js/score.js";
import { unitDisplayBonuses } from "../js/unit-score.js";

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), "utf8"));
const fixture = read("./fixtures/unit-display-through-BJ.json");
const cards = read("../data/generated/cards.json");
const characters = new Map(read("../data/generated/characters.json").map(c => [c.id, c]));
const masterRefs = read("../data/generated/master_refs.json");
const build = o => {
  const prepared = prepareScoreCards(cards, characters, Object.fromEntries(o.profiles.map(p => [p.id, p])), { masterRefs });
  return { leader: prepared.get(o.leaderId), members: o.memberIds.map(id => prepared.get(id)), accountBonuses: o.accountBonuses };
};
const results = new Map();
let pairs = 0, matchingPairs = 0, active = 0, special = 0;
for (const o of fixture.cases) {
  const args = build(o), score = evaluateDeck(args);
  assert.ok(score, o.id);
  assert.equal(score.detail.unitBonusModel, "normalized-200-v1", o.id);
  results.set(o.id, score);
  let matches = true;
  for (const field of ["active", "special", "passive", "board"]) {
    const expected = o.observed[field];
    if (expected == null && !(field === "passive" && o.passiveAbsent)) continue;
    const actual = score.detail.scoreBonus[field];
    const known = o.knownDifference?.[field];
    if (known) {
      assert.equal(expected, known.observed);
      assert.equal(actual, known.model, `${o.id}: preserve documented residual, not a per-case correction`);
      matches = false;
    } else assert.equal(actual, expected ?? 0, `${o.id}: ${field}`);
    if (field === "active") active++;
    if (field === "special") special++;
  }
  if (!o.partialObservation) { pairs++; if (matches) matchingPairs++; }
  assert.ok(score.potentialUnitScore >= score.unitScore, `${o.id}: potential lower bound`);
}
assert.equal(pairs, 53);
assert.equal(matchingPairs, 52);
assert.equal(active, 49);
assert.equal(special, 49);
assert.equal(new Set(fixture.cases.map(o => [...o.memberIds].sort().join("|"))).size, 27);
assert.deepEqual(results.get("AX").detail.scoreBonus, results.get("BI").detail.scoreBonus,
  "Generic display must not depend on SP placement");

const bg = fixture.cases.find(o => o.id === "BG");
const ax = fixture.cases.find(o => o.id === "AX");
const args = build(bg);
const preparedComposition = prepareDeckComposition(args);
const reused = evaluateDeck({ ...args, accountBonuses: ax.accountBonuses, preparedComposition });
const fresh = evaluateDeck({ ...args, accountBonuses: ax.accountBonuses });
assert.deepEqual(reused.detail.scoreBonus, fresh.detail.scoreBonus, "Board changes must invalidate prepared composition");
assert.notEqual(reused.detail.scoreBonus.board, preparedComposition.scoreBonusDetail.board);
const withoutAccount = evaluateDeck({ ...args, accountBonuses: undefined });
assert.equal(withoutAccount.detail.scoreBonus.board, 0, "No personal board defaults");
assert.equal(withoutAccount.detail.scoreBonus.active, fresh.detail.scoreBonus.active);
assert.equal(withoutAccount.detail.scoreBonus.special, fresh.detail.scoreBonus.special);

// Endpoint conventions: first check at t=10, duration=1 covers t=10,20,...,200.
const member = { probability: .5, interval: 10, duration: 1, value: 100, support: 0,
  rate: 0, frequency: 0, specialSupport: 0, specialDuration: 0, specialRate: 0 };
assert.equal(unitDisplayBonuses([member]).active, 5);
assert.deepEqual(unitDisplayBonuses([{ ...member, probability: 0 }]),
  { outfit: 0, active: 0, passive: 0, board: 0, special: 0 });
assert.equal(unitDisplayBonuses([{ ...member, probability: 0 }], { maximize: true }).active, 0,
  "A disabled Active does not become an activation in the potential model");
assert.equal(unitDisplayBonuses([{ ...member, specialRate: 50 }], { maximize: true }).special, 0,
  "All-success potential must not count SP activation-rate gain again");
assert.ok(unitDisplayBonuses([{ ...member, support: 20 }]).passive > 0);
console.log(`unit display: ${matchingPairs}/${pairs} observed Passive/Board pairs; ${active} Active / ${special} SP matches; AX/BC/BI 0.1pp residual retained`);
