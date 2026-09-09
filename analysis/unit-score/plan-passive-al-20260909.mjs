import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
import { numericBoardResearch } from './compare-board-ae-20260909.mjs';
import { compareAK } from './compare-passive-ak-20260909.mjs';
import { sourceLock } from './io.mjs';

const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');

export function planAL() {
  const previous = compareAK();
  const aiPath = 'analysis/unit-score/observations/AI-20260909.json';
  const akPath = 'analysis/unit-score/observations/AK-20260909.json';
  const ai = read(aiPath), ak = read(akPath);
  const next = { sampleId: 'AL', leaderId: ak.leaderId, memberIds: [...ai.memberIds],
    profiles: [{ ...ak.profiles.find(p => p.id === ak.leaderId) },
      ...ai.memberIds.map(id => ({ ...ai.profiles.find(p => p.id === id) }))] };
  const base = displayedActiveFeatures(ai), features = displayedActiveFeatures(next);
  const before = numericBoardResearch(ai), board = numericBoardResearch(next);
  const sp = quantizedSupportSP(features);
  assert.equal(previous.summary.observations, 35);
  assert.equal(base.conditions.leaderParameterConditionMet, false);
  assert.equal(features.conditions.leaderParameterConditionMet, true);
  assert.equal(base.conditions.leaderScoreSupport, 0);
  assert.equal(features.conditions.leaderScoreSupport, 0);
  assert.deepEqual(features.SP, base.SP);
  assert.deepEqual(features.conditions.active, base.conditions.active);
  assert.deepEqual(features.conditions.passiveSupport, base.conditions.passiveSupport);
  assert.deepEqual(board.inputs, before.inputs);
  assert.equal(board.leaderCharacterId, before.leaderCharacterId);
  assert.equal(board.leaderBoardSupport, before.leaderBoardSupport);
  assert.equal(board.Braw, before.Braw);
  assert.equal(board.BPraw, before.BPraw);
  assert.equal(features.A, ai.game.scoreBonusDetail.active);
  assert.equal(sp.display, ai.game.scoreBonusDetail.special);
  assert.equal(features.power.memberParameter, ai.game.powerDetail.memberParameter);
  assert.equal(features.power.passive, ai.game.powerDetail.passive);
  const changedSlots = next.memberIds.flatMap((id, index) => id === ak.memberIds[index] ? [] : [{ slot: index + 1, from: ak.memberIds[index], to: id }]);
  assert.equal(changedSlots.length, 1);
  assert.equal(changedSlots[0].slot, 4);
  const baselineValues = { memberParameter: features.power.memberParameter, outfitPower: features.power.outfit,
    passivePower: features.power.passive, active: features.A, special: sp.display };
  assert.deepEqual(baselineValues, { memberParameter: 84026, outfitPower: 12613, passivePower: 13617, active: 73.7, special: 43.6 });
  assert.deepEqual(board.joint.twoCeilPossibleSums, [17.8, 17.9]);
  return {
    schemaVersion: 1, sampleId: 'AL', status: 'Planned; no AL measurement received',
    ...next, comparisonBase: 'AI', convenienceStartingPoint: 'AK', changedSlotsFromAK: changedSlots,
    purpose: 'Compare AI inactive five-star Ririka parameter costume with the always-active three-star Ririka costume; keep the five members, skill conditions, support recipients and recorded leader/member boards fixed.',
    sourceContext: { latestObserved: 'AK', observations: 35, activeAndSPMeasured: 34,
      caution: 'AK confirmed passive and board only. AI supplies the baseline numeric rows; do not treat AK baseline predictions as observations.' },
    control: { AILeader: { id: ai.leaderId, profile: ai.profiles.find(p => p.id === ai.leaderId), parameterCostumeActive: false, modeledPower: base.power.outfit },
      ALLeader: { id: next.leaderId, profile: next.profiles[0], parameterCostumeActive: true, appliedParameterPct: 15 },
      leaderCharacterId: board.leaderCharacterId, leaderBoardSupport: board.leaderBoardSupport,
      memberInputs: board.inputs, activeAndSPUnchanged: true, supportRecipientsUnchanged: true },
    baselineValues, predictedPowerSubtotal: features.retainedPower,
    hypotheses: { passive: { display: ai.game.scoreBonusDetail.passive, kind: 'Same-context invariance under leader-card/costume activation change. Not a general passive formula.' },
      board: { display: ai.game.scoreBonusDetail.board, kind: 'Paired invariance control, not an individual category formula.' },
      conditionalJoint: { raw: board.joint.rawCombined, possibleDisplays: board.joint.twoCeilPossibleSums,
        kind: 'Existing combined raw model plus separate ceiling; not a single exact displayed total.' } },
    decisions: { bothUnchanged: 'Supports display independence from this parameter-costume activation/card change. Combine with AK magnitude control; next separate member-board competition from SP/costume effects.',
      splitChangesButSumCompatible: 'Rejects this split-invariance hypothesis while preserving conditional combined compatibility. Identifies leader-card/costume context dependence, not a unique causal formula.',
      sumOutsideRange: 'Challenges the combined model or an assumed input as well as the split. Preserve failure and check input identity before revising.',
      baselineMismatch: 'Check member growth and formation first; reported AI power costume was null, whereas AL12613 is a new prediction.',
      missingValues: 'Record only explicitly supplied rows; do not turn absent rows into predicted numbers.' },
    limits: [
      'Leader card, its level, and its member-role skills also differ; the existing model excludes those skills in the leader slot. The intervention is not a literal costume switch.',
      'Both member-role boards and Ririka score/judgement board unlocks must remain unchanged. Formation view before song selection is inherited from the earlier plan.',
      'Displayed equality only constrains0.1% precision; it does not prove equality of unrounded internals or independence for every costume.',
      'A success tests invariance, not a formula for allocating the combined raw increment.'
    ],
    requestedMeasurements: ['passive score', 'Holomember board score', 'member parameter', 'outfit power', 'passive power', 'Active', 'SP'],
    requestPriority: 'Passive and board first. Five baseline values or a detail screenshot help confirm the planned control. Total score bonus optional.',
    followUpDesign: { status: 'Candidate direction only; no new experiment number or measurement request frozen',
      description: 'With Ririka3-star leader and Ayame/Towa/regular Flare/Noel fixed, compare swimsuit Suisei60/0 against swimsuit Kanade40/0 as the fifth member.',
      advantage: 'Same23s/46%/8s/100% Active, unchanged Noel9% recipients(Noel/Flare), no additional score-support passive, but documented member rate board0% vs20%.',
      remainingConfounders: 'SP and stats/character differ. A change would not by itself prove a board-only cause; inspect SP contribution hypotheses too.' },
    provenance: { sourceHashes: sourceLock(), inputs: Object.fromEntries([
      aiPath, akPath, 'analysis/unit-score/experiments/AK-status-observed-20260909.json',
      'analysis/unit-score/experiments/baseline-passive-AK-20260909.json',
      'analysis/unit-score/board-context.json', 'analysis/unit-score/board-observations/ririka-X-20260909.json',
      'analysis/unit-score/board-observations/AA-member-clarification-20260909.json',
      'analysis/unit-score/profile-observations/ririka-3star-20260909.json'
    ].map(p => [p, hash(p)])), analysisSourceSHA256: hash('analysis/unit-score/plan-passive-al-20260909.mjs'),
      predictionsAndProductionUnchanged: true }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planAL(), null, 2));
