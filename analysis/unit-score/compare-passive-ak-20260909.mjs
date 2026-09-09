import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compareAJAndPlanAK } from './compare-passive-aj-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
import { numericBoardResearch } from './compare-board-ae-20260909.mjs';
import { sourceLock } from './io.mjs';

const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');

export function compareAK() {
  const checkpoint = 'analysis/unit-score/experiments/baseline-passive-AK-20260909.json';
  const observationPath = 'analysis/unit-score/observations/AK-20260909.json';
  const plan = read(checkpoint), observation = read(observationPath);
  assert.equal(hash(checkpoint), observation.predictionCheckpointSHA256);
  assert.deepEqual(sourceLock(), plan.sourceHashes);
  for (const [p, h] of Object.entries({ ...plan.newEvidenceHashes, ...plan.observationHashes, ...plan.previousSourceLocks })) assert.equal(hash(p), h, p);
  assert.equal(hash('analysis/unit-score/compare-passive-aj-20260909.mjs'), plan.analysisSourceSHA256);
  const previous = compareAJAndPlanAK();
  assert.deepEqual(previous.next.hypotheses, plan.hypotheses);
  assert.equal(observation.leaderId, plan.leaderId);
  assert.deepEqual(observation.memberIds, plan.memberIds);
  assert.deepEqual(observation.profiles, plan.profiles);
  const reference = observation.confirmedByReference;
  assert.equal(hash(reference.source), reference.sourceSHA256);
  const aj = read(reference.source);
  const comparisons = ['passive', 'board'].map(item => {
    const observed = observation.game.scoreBonusDetail[item];
    assert.equal(observed, reference.fields[item]);
    assert.equal(observed, aj.game.scoreBonusDetail[item]);
    return { item, predicted: plan.hypotheses[item].display, observed,
      deltaFromAJ: Number((observed - aj.game.scoreBonusDetail[item]).toFixed(9)),
      matches: observed === plan.hypotheses[item].display };
  });
  // The reply confirms only two score rows. Never promote predictions to observations.
  for (const value of Object.values(observation.game.powerDetail)) assert.equal(value, null);
  for (const key of ['outfit', 'active', 'special']) assert.equal(observation.game.scoreBonusDetail[key], null);
  for (const key of ['unitScore', 'overallPower', 'scoreBonusPct']) assert.equal(observation.game[key], null);
  const f = displayedActiveFeatures(observation), sp = quantizedSupportSP(f), board = numericBoardResearch(observation);
  assert.deepEqual(f.power, plan.features.power);
  assert.equal(f.A, plan.features.A);
  assert.deepEqual(sp, plan.quantized);
  assert.deepEqual(board.inputs, plan.numericBoardFeatures.inputs);
  assert.equal(board.leaderBoardSupport, plan.numericBoardFeatures.leaderBoardSupport);
  const knownRows = [...previous.rows, f];
  const reportedSum = Number(comparisons.reduce((sum, c) => sum + c.observed, 0).toFixed(9));
  return {
    schemaVersion: 1, sampleId: 'AK', status: 'Two score categories observed; remaining values unreported',
    observation, comparisons,
    jointComparison: { derivedSum: reportedSum, frozenPossibleDisplays: plan.hypotheses.conditionalJoint.possibleDisplays,
      compatible: plan.hypotheses.conditionalJoint.possibleDisplays.includes(reportedSum),
      status: 'Sum of two confirmed displayed categories, not a reported total score bonus.' },
    unconfirmedPredictions: { memberParameter: f.power.memberParameter, outfitPower: f.power.outfit,
      passivePower: f.power.passive, retainedPower: f.retainedPower, active: f.A, special: sp.display },
    diagnosticOnly: { individualBoardReference: board.boardReference, individualBoardMatches: board.boardMatches,
      jointRaw: board.joint.rawCombined, status: 'The standalone board formula remains rejected.' },
    summary: { observations: knownRows.length, distinctMemberSets: new Set(knownRows.map(r => [...r.memberIds].sort().join(','))).size,
      activeObserved: previous.rows.filter(r => r.observedActive !== null).length, activeMatches: previous.summary.activeMatches,
      spObserved: previous.rows.filter(r => r.observedSP !== null).length, spMatches: previous.summary.refinedSPMatches,
      AKActiveSPUnreported: true, newConfirmedScoreCategories: comparisons.length,
      positivePassiveJointCompatibility: previous.extensionAudit.positivePassive.jointCompatible + Number(board.joint.compatible),
      retrospectiveJointChecks: 14, prospectiveJointChecks: ['AF', 'AG', 'AH', 'AI', 'AJ', 'AK'],
      individualPassiveFormulaConfirmed: false, individualBoardFormulaConfirmed: false },
    interpretation: {
      supported: 'Displayed passive1.5 and board12.2 are invariant in this same-member/same-character Ririka leader-card control, with planned parameter costume50% ->15%.',
      limitations: 'Equality is at displayed0.1% precision. Both costumes are active. No proof of universal costume independence, binary on/off independence, hidden unrounded equality, or a general passive formula.',
      nextDirection: 'Investigate composition-dependent leader/board interactions; if considering an active/inactive costume control, establish an available same-character control first. No new experiment or numeric prediction is frozen here.'
    },
    provenance: { checkpoint, checkpointSHA256: hash(checkpoint), observationPath, observationSHA256: hash(observationPath),
      AJObservationSHA256: hash(reference.source), analysisSourceSHA256: hash('analysis/unit-score/compare-passive-ak-20260909.mjs'),
      sourceHashes: sourceLock(), predictionsAndProductionUnchanged: true }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareAK(), null, 2));
