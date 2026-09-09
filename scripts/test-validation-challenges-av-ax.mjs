import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { planChallenges } from '../analysis/unit-score/plan-challenges-av-ax-20260909.mjs';
import { collectCatalog } from '../analysis/unit-score/compare-am-an-20260909.mjs';
const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function verifyChallengePlans() {
  const p = planChallenges();
  assert.deepEqual(p, read('analysis/unit-score/experiments/baseline-challenges-AV-AX-20260909.json'));
  for (const k of ['catalog', 'subset', 'ar', 'board']) {
    const path = k === 'catalog' ? p.provenance.catalog : p.provenance[`${k}Path`];
    assert.equal(hash(path), p.provenance[`${k}SHA256`]);
  }
  for (const [path, value] of Object.entries(p.provenance.sourceHashes)) assert.equal(hash(path), value);
  const observed = collectCatalog(p.provenance.catalog);
  assert.equal(observed.length, 44);
  assert.ok(observed.every(o => !p.futureSampleIds.includes(o.sampleId)));
  const oldSets = new Set(observed.map(o => [...o.memberIds].sort().join(',')));
  const cards = new Map(read('data/generated/cards.json').map(c => [c.id, c]));
  const inventoryIds = read(p.provenance.subsetPath).ownedCards.map(p => p.id).filter(id => cards.get(id).character_id !== 'chr-06003');
  let newSets = 0;
  const visit = (start, ids) => {
    if (ids.length === 5) {
      if (new Set(ids.map(id => cards.get(id).character_id)).size === 5 && !oldSets.has([...ids].sort().join(','))) newSets++;
      return;
    }
    for (let i = start; i < inventoryIds.length; i++) visit(i + 1, [...ids, inventoryIds[i]]);
  };
  visit(0, []);
  assert.equal(newSets, 124); assert.equal(p.selection.newSetsExamined, newSets);
  const [av, aw, ax] = p.plans;
  assert.deepEqual(p.plans.map(c => [c.prediction.passive, c.prediction.board, c.prediction.active, c.prediction.special]),
    [[2.4, 10.3, 64.2, 37.3], [4.7, 11.3, 74, 42.9], [0, 10.8, 68.9, 37.5]]);
  assert.ok(av.alternatives.every(c => c.passive === 2.4 && c.board === 10.2));
  assert.deepEqual(av.memberIds.slice(0, 4), aw.memberIds.slice(0, 4));
  assert.notEqual(av.memberIds[4], aw.memberIds[4]);
  assert.equal(aw.boardOverrides['chr-00026'].rate, 24.5); assert.equal(aw.boardOverrides['chr-00026'].cooldown, 4);
  assert.equal(Math.max(...Object.values(aw.diagnostic.supportByMember)), 25);
  assert.equal(ax.diagnostic.passiveScoreRowExpected, false);
  for (const c of p.plans) {
    assert.deepEqual(c.observationsReceived, []);
    assert.equal('game' in c, false);
    assert.equal(c.leaderJudgmentEnabled, true);
    assert.equal(c.leaderSupportPct, 13.3);
    assert.deepEqual(c.boardOverrides['chr-00022'], { rate: 17.8, cooldown: 0 });
    assert.deepEqual(c.boardOverrides['chr-06002'], { rate: 0, cooldown: 0 });
    assert.ok(c.requestedMeasurements.includes('passive score (or row absent)'));
  }
  assert.equal(p.productionFormulaChanged, false);
  return { status: 'PASS', observedCountUnchanged: 44, firstRequested: 'AV', plannedOnly: p.futureSampleIds,
    candidateSetsConsidered: newSets, forecasts: p.plans.map(c => ({ id: c.sampleId, ...c.prediction })) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(verifyChallengePlans(), null, 2));
