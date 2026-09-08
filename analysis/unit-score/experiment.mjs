import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from './io.mjs';
const frozen = JSON.parse(fs.readFileSync(new URL('archive/next-predictions-20260909.json', import.meta.url), 'utf8'));
const powerKeys = ['memberParameter', 'outfit', 'board', 'passive', 'memory', 'enhancement'];
const bonusKeys = ['outfit', 'active', 'board', 'passive', 'special'];
const round = x => Math.round(x * 10) / 10;
export function makeTemplate(id) {
  const prediction = frozen.predictions.find(p => p.id === id);
  if (!prediction) throw new Error(`Unknown planned experiment: ${id}`);
  return { schemaVersion: 1, sampleId: id, observedAt: null, gameVersion: null,
    predictionCheckpoint: 'analysis/unit-score/archive/next-predictions-20260909.json',
    leaderId: prediction.leaderId, memberIds: prediction.memberIds, profiles: prediction.profiles,
    profilesConfirmed: false, boardContext: null, evidence: null,
    game: { unitScore: null, overallPower: null, scoreBonusPct: null,
      powerDetail: Object.fromEntries(powerKeys.map(k => [k, null])),
      scoreBonusDetail: Object.fromEntries(bonusKeys.map(k => [k, null])) },
    notes: 'Enter observed values only. Null in a category means omitted, not an exact zero; unitScore stays null unless directly shown. Confirm the recorded card levels/awakening before comparison.' };
}
export function compareObservation(o) {
  const prediction = frozen.predictions.find(p => p.id === o.sampleId);
  assert.ok(prediction, 'Unknown experiment ID');
  assert.equal(o.profilesConfirmed, true, 'Confirm the actual levels and awakening first');
  assert.deepEqual(o.profiles, prediction.profiles, 'Growth changed: create a new experiment and freeze predictions before measuring');
  assert.equal(o.leaderId, prediction.leaderId);
  assert.deepEqual([...o.memberIds].sort(), [...prediction.memberIds].sort());
  assert.ok(typeof o.observedAt === 'string' && o.observedAt.trim(), 'Record observation date');
  assert.ok(typeof o.boardContext === 'string' && o.boardContext.trim(), 'Record board context; explicitly write unknown where unconfirmed');
  const game = o.game;
  assert.ok(Number.isFinite(game.overallPower) && game.overallPower > 0, 'Enter the displayed overall power');
  assert.ok(Number.isFinite(game.scoreBonusPct) && game.scoreBonusPct >= 0, 'Enter the displayed total bonus');
  const checkParts = (detail, keys) => {
    assert.deepEqual(Object.keys(detail).sort(), [...keys].sort());
    for (const key of keys) assert.ok(detail[key] === null || Number.isFinite(detail[key]) && detail[key] >= 0, `Invalid ${key}`);
    return keys.reduce((sum, key) => sum + (detail[key] ?? 0), 0);
  };
  assert.equal(checkParts(game.powerDetail, powerKeys), game.overallPower, 'Power components must match the screenshot total');
  assert.equal(round(checkParts(game.scoreBonusDetail, bonusKeys)), game.scoreBonusPct, 'Bonus components must match the screenshot total');
  assert.ok(Number.isFinite(game.powerDetail.memberParameter));
  assert.ok(Number.isFinite(game.scoreBonusDetail.active));
  const differences = {};
  for (const [name, p] of Object.entries(prediction.research)) {
    if (name === 'inputs') continue;
    const category = name.startsWith('passive') ? 'passive' : name.startsWith('special') ? 'special'
      : name.startsWith('outfit') ? 'outfit' : 'active';
    const observed = game.scoreBonusDetail[category];
    differences[name] = { observed, prediction: p,
      rawErrorPp: observed === null ? null : p.raw - observed,
      ceilDisplayMatches: observed === null ? null : p.ceil === observed };
  }
  return { sampleId: o.sampleId, scope: 'Comparison against frozen hypotheses; no fitting or historical writes. Board indirect effects remain unresolved.',
    retainedPower: game.overallPower - (game.powerDetail.board ?? 0) - (game.powerDetail.memory ?? 0) - (game.powerDetail.enhancement ?? 0),
    retainedBonus: round(game.scoreBonusPct - (game.scoreBonusDetail.board ?? 0)),
    directUnitScore: game.unitScore ?? null, enginePrediction: prediction.engine, differences };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, value, ...extra] = process.argv.slice(2);
  if (extra.length) throw new Error('Unexpected arguments');
  if (mode === '--init' && value) {
    const template = makeTemplate(value);
    const target = path.join(repositoryRoot, '.local', 'scoring-validation', `${value}.observation.json`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(template, null, 2) + '\n', { flag: 'wx' });
    console.log(`Observation template created: ${target}`);
  } else if (mode === '--compare' && value) {
    console.log(JSON.stringify(compareObservation(JSON.parse(fs.readFileSync(path.resolve(value), 'utf8'))), null, 2));
  } else throw new Error('Usage: node analysis/unit-score/experiment.mjs --init L | --compare path/to/observation.json');
}
