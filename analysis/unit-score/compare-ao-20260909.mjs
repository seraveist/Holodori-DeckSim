import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { planAO } from './plan-board-ao-20260909.mjs';
import { compareAMAN } from './compare-am-an-20260909.mjs';
import { interventionValues } from './board-intervention-20260909.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');

export function compareAO() {
  const checkpoint = 'analysis/unit-score/experiments/baseline-board-AO-20260909.json';
  const observationPath = 'analysis/unit-score/observations/AO-20260909.json';
  const plan = read(checkpoint), observation = read(observationPath), previous = compareAMAN();
  assert.deepEqual(plan, planAO());
  assert.equal(observation.predictionCheckpointSHA256, hash(checkpoint));
  for (const k of ['leaderId', 'memberIds', 'profiles', 'boardOverrides']) assert.deepEqual(observation[k], plan[k]);
  const values = interventionValues(observation, observation.boardOverrides);
  assert.deepEqual(values, plan.after);
  const score = observation.game.scoreBonusDetail;
  const joint = Number((score.passive + score.board).toFixed(9));
  return { schemaVersion: 1, latestObserved: 'AO', observation,
    comparisons: [
      { hypothesis: 'timingBoardExplainsAMANDifference', expected: plan.hypotheses.timingBoardExplainsAMANDifference,
        observed: { passive: score.passive, board: score.board }, matches: score.passive === 1.7 && score.board === 9.4 },
      { hypothesis: 'invarianceToThisTimingBoard', expectedPassive: 1.6, observedPassive: score.passive, matches: score.passive === 1.6 },
      { hypothesis: 'conditionalJoint', possibleDisplays: plan.hypotheses.conditionalJoint.possibleDisplays,
        observed: joint, compatible: plan.hypotheses.conditionalJoint.possibleDisplays.includes(joint) } ],
    arithmetic: { reportedSum: null, derivedJoint: joint, ANtoAO: { passive: .1, board: -.7, joint: -.6 },
      note: 'Only passive and board score rows were supplied; all totals, Active/SP and power rows remain unreported.' },
    summary: { ...previous.summary, observations: previous.summary.observations + 1,
      positivePassiveJointCompatibility: previous.summary.positivePassiveJointCompatibility + 1,
      prospectiveJointChecks: [...previous.summary.prospectiveJointChecks, 'AO'], AOActiveSPUnreported: true },
    interpretation: { supported: 'Under the requested unchanged-card/SP/other-board controls, disabling Kanade rate15+5 changes displayed passive1.6->1.7 and board10.1->9.4. This demonstrates a timing-board effect on the split in this control.',
      caveats: ['Controls are inherited from the requested experiment, not separately audited in the two-number answer.',
        'Agreement with AM does not prove all SP independence or a general allocation formula.', 'Unreported baseline values are not counted as new matches.'],
      productionFormulaChanged: false, allocationFormulaConfirmed: false },
    provenance: { checkpoint, checkpointSHA256: hash(checkpoint), observationPath, observationSHA256: hash(observationPath),
      analysisSourceSHA256: hash('analysis/unit-score/compare-ao-20260909.mjs'), sourceHashes: plan.provenance.sourceHashes,
      predictionsAndProductionUnchanged: true } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareAO(), null, 2));
