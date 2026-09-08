import assert from "node:assert/strict";
import fs from "node:fs";
import { prepareScoreCards } from "../js/card-prepare.js";
import { evaluateDeck, unitScoreFromDisplayed, SCORE_ENGINE_VERSION } from "../js/score.js";

const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const fixture = read("./fixtures/unit-observations-20260908.json");
const data = name => read(`../data/generated/${name}.json`);
const prepared = prepareScoreCards(data("cards"), new Map(data("characters").map(c => [c.id, c])),
  Object.fromEntries(fixture.profiles.map(({ id, level, potential }) => [id, { level, potential }])),
  { masterRefs: data("master_refs"), levelMode: "current" });
const round1 = x => Math.round(x * 10) / 10;
const evaluated = new Map();
const rows = fixture.observations.map(o => {
  const { powerDetail: power, scoreBonusDetail: bonus } = o.game;
  assert.equal(o.game.unitScore, null, `${o.sampleId}: no final Unit Score was directly observed`);
  assert.equal(Object.values(power).reduce((s, x) => s + (x ?? 0), 0), o.game.overallPower);
  // Null denotes an omitted category, not a measured exact zero. Visible
  // categories account for the total at the screenshot's display precision.
  assert.equal(round1(Object.values(bonus).reduce((s, x) => s + (x ?? 0), 0)), o.game.scoreBonusPct);
  const retainedPower = o.game.overallPower - power.board - power.memory - power.enhancement;
  const retainedBonus = round1(o.game.scoreBonusPct - bonus.board);
  assert.equal(retainedPower, o.retained.overallPower);
  assert.equal(retainedBonus, o.retained.scoreBonusPct);
  const leader = prepared.get(o.leaderId), members = o.memberIds.map(id => prepared.get(id));
  assert.ok(leader && members.every(Boolean), `${o.sampleId}: fixture cards must still exist`);
  const result = evaluateDeck({ leader, members });
  assert.ok(result, `${o.sampleId}: formation must be valid`);
  // Only confirmed parameter rules are a hard gate. Do not turn a known
  // Active/Passive/SP approximation into a fabricated game-exact assertion.
  for (const category of ["memberParameter", "outfit", "passive"]) {
    assert.equal(result.detail.power[category], power[category] ?? 0, `${o.sampleId}: ${category}`);
  }
  assert.equal(result.overallPower, retainedPower, `${o.sampleId}: retained overall power`);
  evaluated.set(o.sampleId, result);
  const derivedReference = unitScoreFromDisplayed(retainedPower, retainedBonus);
  return {
    sampleId: o.sampleId, retainedPower, retainedBonus,
    gameBonus: bonus, engineBonus: result.detail.scoreBonus,
    engineScoreBonus: result.scoreBonusPct, engineUnitScore: result.unitScore,
    derivedReference, errorPct: (result.unitScore / derivedReference - 1) * 100,
  };
});

for (const [first, repeated] of [["A", "B"], ["E", "F"], ["E", "K"]]) {
  const a = evaluated.get(first), b = evaluated.get(repeated);
  assert.equal(a.unitScore, b.unitScore, `${first}/${repeated}: generic order/repeat invariant`);
  assert.equal(a.potentialUnitScore, b.potentialUnitScore);
  assert.deepEqual(a.detail, b.detail);
}
const report = {
  phase: "first integration and observed follow-ups", engineVersion: SCORE_ENGINE_VERSION,
  currentMasterCommit: data("manifest").source_commit,
  observedMasterCommit: fixture.masterSource.commit,
  counts: {
    screens: rows.length,
    memberSets: new Set(fixture.observations.map(o => [...o.memberIds].sort().join(","))).size,
    formations: new Set(fixture.observations.map(o => `${o.leaderId}:${[...o.memberIds].sort().join(",")}`)).size,
  },
  confirmedPowerMatches: rows.length,
  referenceScope: "Displayed board/memory/enhancement power and board bonus subtracted; indirect board effects may remain. Unit Score reference is derived using the current empirical K, not directly observed. This is not a live-song score validation.",
  rows,
};
if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`unit observations: ${report.counts.screens} screens / ${report.counts.memberSets} member sets / ${report.counts.formations} formations; confirmed power and repeats OK`);
  console.table(rows.map(r => ({ sample: r.sampleId, power: r.retainedPower,
    observedBonus: r.retainedBonus, estimatedBonus: r.engineScoreBonus,
    derivedReference: r.derivedReference, estimatedUnit: r.engineUnitScore, errorPct: r.errorPct.toFixed(2) })));
  console.log("Skill-bonus differences above are unresolved measurements, not passing accuracy assertions.");
}
