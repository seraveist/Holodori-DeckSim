import fs from 'node:fs';
import { prepareScoreCards } from '../../js/card-prepare.js';
export const fixture = JSON.parse(fs.readFileSync(new URL('../../scripts/fixtures/unit-observations-20260908.json', import.meta.url), 'utf8'));
const data = name => JSON.parse(fs.readFileSync(new URL(`../../data/generated/${name}.json`, import.meta.url), 'utf8'));
export const prepared = prepareScoreCards(data('cards'), new Map(data('characters').map(c => [c.id, c])),
  Object.fromEntries(fixture.profiles.map(p => [p.id, p])), { masterRefs: data('master_refs'), levelMode: 'current' });
// Adapter preserves the historical research convention: memberIds includes leader first.
export const observations = fixture.observations.map(o => ({ ...o, memberIds: [o.leaderId, ...o.memberIds] }));
export const read = name => {
  const match = /^observation-([A-Z]+)\.json$/.exec(name);
  if (match) {
    const value = observations.find(o => o.sampleId === match[1]);
    if (!value) throw new Error(`Unknown observation: ${name}`);
    return structuredClone(value);
  }
  if (name === 'board-observation-E.json') return JSON.parse(fs.readFileSync(new URL('board-context.json', import.meta.url), 'utf8'));
  throw new Error(`Unsupported historical input: ${name}`);
};
export const membersOf = o => o.memberIds.slice(1).map(id => prepared.get(id));
