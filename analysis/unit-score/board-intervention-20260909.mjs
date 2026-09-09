import fs from 'node:fs';
import assert from 'node:assert/strict';
import { prepareScoreCards } from '../../js/card-prepare.js';
import { numericBoardResearch } from './compare-board-ae-20260909.mjs';
import { integrate, round1 } from './dummy-model-lab.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const cards = read('data/generated/cards.json');
const characters = new Map(read('data/generated/characters.json').map(c => [c.id, c]));
const masterRefs = read('data/generated/master_refs.json');
const defaultProfiles = read('scripts/fixtures/unit-observations-20260908.json').profiles;

// A new research adapter: never rewrite the historical board inputs for old observations.
export function interventionEnvironment(o, overrides = {}) {
  const baseline = numericBoardResearch(o);
  assert.equal(baseline.excluded, false, baseline.reason);
  const prepared = prepareScoreCards(cards, characters, Object.fromEntries((o.profiles ?? defaultProfiles).map(p => [p.id, p])),
    { masterRefs, levelMode: 'current' });
  for (const [id, value] of Object.entries(overrides)) {
    assert.ok(baseline.inputs.some(m => m.characterId === id), `Override outside members: ${id}`);
    assert.deepEqual(Object.keys(value).sort(), ['cooldown', 'rate']);
    assert.ok(Object.values(value).every(v => Number.isFinite(v) && v >= 0));
  }
  const inputs = baseline.inputs.map(m => ({ ...m, board: overrides[m.characterId] ?? m.board }));
  const members = o.memberIds.map(id => prepared.get(id));
  const team = { members, support: baseline.support };
  const adjusted = { ...team, members: members.map((m, i) => ({ ...m, active: { ...m.active,
    probability: Math.min(1, m.active.probability * (1 + inputs[i].board.rate / 100)),
    interval: m.active.interval / (1 + inputs[i].board.cooldown / 100) } })) };
  return { team, adjusted, inputs, leaderBoardSupport: baseline.leaderBoardSupport,
    leader: prepared.get(o.leaderId), baseline };
}

export function interventionValues(o, overrides = {}) {
  const e = interventionEnvironment(o, overrides);
  const Araw = integrate(e.team);
  const Braw = integrate(e.adjusted, { outfit: e.leaderBoardSupport });
  const BPraw = integrate(e.adjusted, { outfit: e.leaderBoardSupport, passive: true });
  const raw = BPraw - Araw;
  return { inputs: e.inputs, Araw, Braw, BPraw, raw,
    possibleDisplays: [round1(raw), Number((round1(raw) + .1).toFixed(9))] };
}
