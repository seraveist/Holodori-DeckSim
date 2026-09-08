import { prepared, read, membersOf } from './validation-data.mjs';
import { prepareDeckComposition } from '../../js/score.js';

export const ids = ['A', 'C', 'D', 'E', 'G', 'H', 'I', 'J'];
export const observations = ids.map(id => read(`observation-${id}.json`));
const b = read('board-observation-E.json');
const sum = a => a.reduce((s, x) => s + x, 0);
export const boards = new Map(b.members.map(m => [m.characterId, {
  rate: sum(m.activationRateUpNodesPct), cooldown: sum(m.cooldownShortenNodesPct),
}]));
export const teams = observations.map(o => {
  const members = membersOf(o), leader = prepared.get(o.memberIds[0]);
  const c = prepareDeckComposition({ leader, members });
  return { id: o.sampleId, game: o.game.scoreBonusDetail, members,
    support: members.map(m => c.passive.supportByMember[m.id]),
    outfit: c.leaderEffects.support,
    leaderBoardSupport: leader.characterId === 'chr-06003' ? 13.3 : 0 };
});
export const round1 = (v, mode = 'ceil') => mode === 'ceil' ? Math.ceil((v - 1e-10) * 10) / 10
  : mode === 'floor' ? Math.floor((v + 1e-10) * 10) / 10 : Math.round(v * 10) / 10;

export function condition(c, team, combo = 800) {
  if (!c) return true;
  if (c.kind === 'attribute') return team.members.filter(m => m.attribute === c.value).length >= c.count;
  if (c.kind === 'group') return team.members.filter(m => m.groupings.has(c.value)).length >= c.count;
  if (c.kind === 'life') return c.threshold <= 1000;
  if (c.kind === 'combo') return c.threshold <= combo;
  throw new Error(`Unsupported condition ${c.kind}`);
}

export function kernel(team, time, {
  duration = 200, aggregation = 'weighted', board = false, cooldownRounding = 'raw',
  outfit = 0, passive = false, sp = null, spStart = 0, probabilityTiming = 'instant',
  comboMode = 'met', notes = 800, offset = 0, firstImmediate = false,
  probabilityBoost = 'relative',
} = {}) {
  const skillIsOn = t => sp && t >= spStart && t < spStart + sp.duration;
  const spOn = skillIsOn(time);
  const spRate = sp && condition(sp.condition, team) ? sp.activationRateUp : 0;
  const active = [];
  for (let i = 0; i < team.members.length; i++) {
    const m = team.members[i], a = m.active;
    const boardEffect = board ? boards.get(m.characterId) : null;
    if (board && !boardEffect) throw new Error(`Missing board input: ${m.characterId}`);
    let interval = a.interval * (1 - (boardEffect?.cooldown ?? 0) / 100);
    if (cooldownRounding !== 'raw') interval = Math[cooldownRounding](interval);
    const t = time - offset;
    if (t < (firstImmediate ? 0 : interval)) continue;
    const check = Math.floor((t + 1e-9) / interval) * interval + offset;
    if (time - check >= a.duration - 1e-9) continue;
    const spAtCheck = probabilityTiming === 'instant' ? spOn : skillIsOn(check);
    const probability = Math.min(1, a.probability * (1 + (boardEffect?.rate ?? 0) / 100)
      + (spAtCheck ? spRate / 100 * (probabilityBoost === 'relative' ? a.probability : 1) : 0));
    const combo = comboMode === 'met' ? 800 : comboMode === 'unmet' ? 0 : Math.floor(notes * check / duration);
    const value = (condition(a.condition, team, combo) ? a.conditionalScoreUp : a.baseScoreUp)
      * (1 + (outfit + (passive ? team.support[i] : 0) + (spOn ? sp.support : 0)) / 100);
    active.push({ value, probability, index: i });
  }
  if (aggregation === 'weighted') {
    const p = active.reduce((s, x) => s + x.probability, 0);
    return active.reduce((s, x) => s + x.value * x.probability, 0) / Math.max(1, p);
  }
  if (aggregation === 'maximum') {
    let q = 1, sum = 0;
    for (const x of active.sort((a, b) => b.value - a.value)) {
      sum += q * x.probability * x.value;
      q *= 1 - x.probability;
    }
    return sum;
  }
  throw new Error(`Unsupported aggregation: ${aggregation}`);
}

export function integrate(team, config = {}) {
  const duration = config.duration ?? 200, step = config.step ?? 1, samplePhase = config.samplePhase ?? 1;
  let sum = 0;
  const count = Math.round(duration / step);
  if (Math.abs(count * step - duration) > 1e-8) throw new Error('Duration must contain a whole number of samples');
  for (let i = 0; i < count; i++) sum += kernel(team, (i + samplePhase) * step, config) / count;
  return sum;
}

export function specialGains(team, starts, config = {}) {
  const duration = config.duration ?? 200;
  // Each SP is evaluated alone at each slot; the windows in the tested grids
  // do not overlap. For check-time probabilities, later single-SP residuals
  // can interact across slots; these are candidates, not an exact live claim.
  return team.members.map(m => starts.map(start => {
    let sum = 0;
    const end = Math.min(duration, start + m.special.duration + (config.probabilityTiming === 'check' ? 40 : 0));
    for (let time = Math.max(1, Math.ceil(start)); time <= end; time++) {
      sum += (kernel(team, time, { ...config, sp: m.special, spStart: start }) - kernel(team, time, config)) / duration;
    }
    return sum;
  }));
}

export function permutationValues(matrix) {
  const result = [];
  const visit = (used, sum, slot) => {
    if (slot === 5) { result.push(sum); return; }
    for (let member = 0; member < 5; member++) if (!(used & (1 << member))) visit(used | (1 << member), sum + matrix[member][slot], slot + 1);
  };
  visit(0, 0, 0);
  return result;
}
