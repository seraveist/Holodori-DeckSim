import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { collectCatalog } from './compare-am-an-20260909.mjs';
import { allocationFeatures } from './probe-proportional-allocation-20260909.mjs';
import { selectedPrediction } from './probe-expanded-at-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
import { round1 } from './dummy-model-lab.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function compareAW() {
  const observationPath = 'analysis/unit-score/observations/AW-20260909.json';
  const o = read(observationPath), checkpoint = read(o.predictionCheckpoint);
  assert.equal(hash(o.predictionCheckpoint), o.predictionCheckpointSHA256);
  const plan = checkpoint.plans.find(p => p.sampleId === 'AW');
  for (const key of ['leaderId', 'memberIds', 'profiles', 'boardOverrides']) assert.deepEqual(o[key], plan[key]);
  const f = allocationFeatures(o), p = selectedPrediction(f), a = displayedActiveFeatures(o), sp = quantizedSupportSP(a);
  const computed = { passive: p.passive, board: p.board, active: a.A, special: sp.display };
  for (const [key, value] of Object.entries(computed)) assert.equal(value, plan.prediction[key]);
  const comparisons = Object.entries(computed).map(([key, predicted]) => ({ key, predicted, observed: o.game.scoreBonusDetail[key], matches: predicted === o.game.scoreBonusDetail[key] }));
  const previousCatalog = 'analysis/unit-score/observation-catalog-AT-20260909.json';
  const previous = read(previousCatalog), entries = [...collectCatalog(previousCatalog), { ...o, rawGame: o.game }];
  const joint = Number((o.game.scoreBonusDetail.passive + o.game.scoreBonusDetail.board).toFixed(9));
  const possible = [round1(f.raw), Number((round1(f.raw) + .1).toFixed(9))];
  return { schemaVersion: 1, latestObserved: 'AW', observation: o, comparisons,
    selectedCandidate: { passive: p.passive, board: p.board, pairMatches: p.passiveMatches && p.boardMatches,
      retrospectivePairsThroughAT: 40, prospectivePairs: { measured: 1, matches: Number(p.passiveMatches && p.boardMatches), ids: ['AW'] } },
    alternatives: plan.alternatives.map(c => ({ ...c, passiveMatches: c.passive === o.game.scoreBonusDetail.passive,
      boardMatches: c.board === o.game.scoreBonusDetail.board })),
    joint: { raw: f.raw, possibleDisplays: possible, observed: joint, compatible: possible.includes(joint) },
    summary: { ...previous.summary, observations: entries.length,
      distinctMemberSets: new Set(entries.map(e => [...e.memberIds].sort().join(','))).size,
      activeObserved: previous.summary.activeObserved + 1, activeMatches: previous.summary.activeMatches + Number(a.A === o.game.scoreBonusDetail.active),
      spObserved: previous.summary.spObserved + 1, spMatches: previous.summary.spMatches + Number(sp.display === o.game.scoreBonusDetail.special),
      positivePassiveJointCompatibility: previous.summary.positivePassiveJointCompatibility + Number(possible.includes(joint)),
      prospectiveJointChecks: [...previous.summary.prospectiveJointChecks, 'AW'],
      AWPowerUnreported: true, expandedCandidateProspectivePairs: 1, expandedCandidateProspectiveMatches: Number(p.passiveMatches && p.boardMatches) },
    interpretation: { newIndependentMemberSet: true, scope: 'AW all-match reply confirms the four numeric score rows in the most recent user-facing forecast table. No power rows or totals were newly confirmed.',
      history: 'The plan and forecast were presented before the reply; Git packaging occurs after this reply. AW was measured before AV; do not infer AV, AX or AU measurements.',
      limitations: ['Card/node settings are inherited from the stated procedure, not separately audited in an image.',
        'The denominator-only alternative also matches AW, so this one success does not identify a unique internal formula.'], productionFormulaChanged: false },
    provenance: { observationPath, observationSHA256: hash(observationPath), checkpoint: o.predictionCheckpoint, checkpointSHA256: o.predictionCheckpointSHA256,
      previousCatalog, previousCatalogSHA256: hash(previousCatalog),
      analysisSourceSHA256: hash('analysis/unit-score/compare-aw-20260909.mjs'),
      modelSourceSHA256: hash('analysis/unit-score/probe-expanded-at-20260909.mjs'),
      kernelSourceSHA256: hash('analysis/unit-score/expanded-kernel-at-20260909.mjs') } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareAW(), null, 2));
