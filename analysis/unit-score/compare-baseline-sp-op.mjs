import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { prepareScoreCards } from '../../js/card-prepare.js';
import { evaluateDeck, prepareDeckComposition } from '../../js/score.js';
import { integrate, round1, condition } from './dummy-model-lab.mjs';
import { sourceLock } from './io.mjs';

const root = new URL('../../', import.meta.url);
const read = path => JSON.parse(fs.readFileSync(new URL(path, root), 'utf8'));
const hash = path => crypto.createHash('sha256').update(fs.readFileSync(new URL(path, root))).digest('hex');
const difference = (a, b) => Number((a - b).toFixed(9));

export function compareBaselineOP() {
  const checkpoint = 'analysis/unit-score/experiments/baseline-sp-OP-20260909.json';
  const plan = read(checkpoint);
  const sources = sourceLock();
  assert.deepEqual(sources, plan.sourceHashes, 'Model/card inputs drifted since the prediction');
  assert.equal(hash(plan.coefficientSource), plan.coefficientFileSHA256);
  const cards = read('data/generated/cards.json');
  const characters = new Map(read('data/generated/characters.json').map(c => [c.id,c]));
  const masterRefs = read('data/generated/master_refs.json');
  const rows = plan.experiments.map(prediction => {
    const observation = read(`analysis/unit-score/observations/${prediction.id}-20260909.json`);
    assert.equal(observation.profilesConfirmed, true);
    assert.deepEqual(observation.memberIds, prediction.memberIds);
    assert.equal(observation.leaderId, prediction.leaderId);
    const profiles = Object.fromEntries(observation.profiles.map(p => [p.id,p]));
    const prepared = prepareScoreCards(cards, characters, profiles, { masterRefs, levelMode:'current' });
    const leader = prepared.get(observation.leaderId), members = observation.memberIds.map(id => prepared.get(id));
    const composition = prepareDeckComposition({leader,members});
    const team = {members,support:members.map(m => composition.passive.supportByMember[m.id])};
    const engine = evaluateDeck({leader,members});
    const detail = observation.game.powerDetail, bonus = observation.game.scoreBonusDetail;
    const retainedPower = detail.memberParameter + detail.outfit + detail.passive;
    for (const key of ['memberParameter','outfit','passive']) assert.equal(engine.detail.power[key], detail[key]);
    assert.equal(engine.overallPower, retainedPower);
    assert.equal(composition.leaderEffects.support, 0);
    assert.ok(team.support.every(n => n === 0));
    const actualSP = members.map(m => ({duration:m.special.duration,support:m.special.support,
      activationRateUp:condition(m.special.condition,team) ? m.special.activationRateUp : 0}));
    assert.deepEqual(actualSP, prediction.effectiveSP);
    const activeSignatures = members.map(m => ({cardId:m.id,interval:m.active.interval,duration:m.active.duration,
      probability:m.active.probability,base:m.active.baseScoreUp,conditional:m.active.conditionalScoreUp,condition:m.active.condition}));
    assert.deepEqual(activeSignatures, prediction.activeSignatures);
    const active = integrate(team, {board:false});
    assert.equal(round1(active), bonus.active);
    assert.equal(difference(bonus.active + bonus.board + bonus.special, observation.game.scoreBonusPct), 0);
    const skills = ['active','passive','special'];
    const growthChanges = observation.profiles.flatMap(p => {
      const before = prediction.profiles.find(x => x.id === p.id);
      if (p.level === before.level && p.potential === before.potential) return [];
      const oldPrepared = prepareScoreCards(cards, characters, {...profiles,[p.id]:before}, {masterRefs,levelMode:'current'});
      return [{cardId:p.id,planned:{level:before.level,potential:before.potential},confirmed:{level:p.level,potential:p.potential},
        allThreeSkillsUnchanged:skills.every(key => JSON.stringify(oldPrepared.get(p.id)[key]) === JSON.stringify(prepared.get(p.id)[key]))}];
    });
    const special = Object.fromEntries(['singleCoefficient','twoCoefficients'].map(key => [key,{
      frozenRaw:prediction.specialHypotheses[key].raw,frozenDisplay:prediction.specialHypotheses[key].ceil,
      observed:bonus.special,errorPp:difference(prediction.specialHypotheses[key].ceil,bonus.special),
      displayMatches:prediction.specialHypotheses[key].ceil === bonus.special,
    }]));
    return {id:prediction.id,game:observation.game,retainedPower,
      excludedPowerAggregate:observation.game.overallPower-retainedPower,
      retainedBonusPct:difference(observation.game.scoreBonusPct,bonus.board),
      growthChanges,power:{frozen:prediction.retainedPower,observed:retainedPower,recomputed:engine.overallPower,
        frozenDifference:retainedPower-prediction.retainedPower,componentsMatchAfterConfirmedGrowth:true},
      active:{raw:active,frozenMetDisplay:prediction.active.ceil,observed:bonus.active,
        frozenUnmetDisplay:prediction.activeComboUnmet?.ceil ?? null,
        interpretation:prediction.id==='P'?'Matches the pre-existing combo-met alternative; not a unique prediction.':'Matches the frozen prediction.'},
      special,effectiveSP:actualSP,
      controls:{leaderScoreSupport:0,passiveScoreSupport:team.support,activeAndSPSignaturesUnchanged:true,
        omittedBonusCategories:'User confirmed outfit and passive rows absent; values remain null, not exact measured zeros.'}};
  });
  assert.deepEqual(rows[0].effectiveSP,rows[1].effectiveSP);
  const old = read(plan.coefficientSource).special.separateSupportAndRate;
  const g = old.training.values.find(x => x.id === 'G');
  return {recordedAt:new Date().toISOString(),scope:'Confirmed O/P formation details; board excluded; no directly measured final Unit Score or song score.',
    rows,delta:{activePp:difference(rows[1].game.scoreBonusDetail.active,rows[0].game.scoreBonusDetail.active),
      specialPp:difference(rows[1].game.scoreBonusDetail.special,rows[0].game.scoreBonusDetail.special)},
    conclusion:'The frozen two-coefficient SP approximation matches both new displayed values. The same effective SP bundle gives different bonuses with different receiving Active profiles, supporting Active-context dependence under board exclusion. This does not identify the exact timing, formula, or separate support/rate coefficients.',
    remainingCounterexample:{id:'G',frozenTwoCoefficientRaw:g.prediction,frozenTwoCoefficientDisplay:g.ceilDisplay,
      observed:g.y,errorPp:difference(g.ceilDisplay,g.y),scoreSupportPassive:0},
    predictionCheckpoint:checkpoint,predictionCheckpointSHA256:hash(checkpoint),coefficientFileSHA256:hash(plan.coefficientSource),
    sourceHashes:sources,historicalPredictionsAndCoefficientsUnchanged:true};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareBaselineOP(),null,2));
