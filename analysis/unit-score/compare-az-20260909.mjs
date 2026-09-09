import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { collectCatalog } from './compare-am-an-20260909.mjs';
import { leaderInterventionFeatures } from './plan-leader-at-20260909.mjs';
import { selectedPrediction } from './probe-expanded-at-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function compareAZ() {
  const observationPath = 'analysis/unit-score/observations/AZ-20260909.json', o = read(observationPath);
  assert.equal(hash(o.predictionCheckpoint), o.predictionCheckpointSHA256);
  const plan = read(o.predictionCheckpoint);
  for (const key of ['leaderId', 'memberIds', 'profiles', 'boardOverrides', 'leaderSupportOverride']) assert.deepEqual(o[key], plan[key]);
  const r = leaderInterventionFeatures(o); r.zero = !r.features.some(m => m.s > 0); r.rawPassiveWasAbsent = true;
  const p = selectedPrediction(r), a = displayedActiveFeatures(o), sp = quantizedSupportSP(a);
  const computed = { active: a.A, special: sp.display, passive: p.passive, board: p.board };
  const comparisons = Object.entries(computed).map(([key, predicted]) => {
    assert.equal(predicted, plan.prediction[key]);
    const rawObserved = o.game.scoreBonusDetail[key], absent = key === 'passive' && o.scoreRowPresence.passive === false;
    const observed = absent ? 0 : rawObserved;
    return { key, predicted, rawObserved, observed, normalizedAbsentRow: absent, matches: predicted === observed };
  });
  const previousCatalog = 'analysis/unit-score/observation-catalog-AY-20260909.json', previous = read(previousCatalog);
  const entries = [...collectCatalog(previousCatalog), o];
  const previousReport = read('analysis/unit-score/reports/AV-AX-AY-comparison-20260909.json');
  const ax = previousReport.results.find(r => r.sampleId === 'AX');
  return { schemaVersion: 1, latestObserved: 'AZ', observation: o, comparisons, selected: p,
    summary: { ...previous.summary, observations: entries.length,
      distinctMemberSets: new Set(entries.map(e => [...e.memberIds].sort().join(','))).size,
      activeObserved: previous.summary.activeObserved + 1, activeMatches: previous.summary.activeMatches + Number(a.A === o.game.scoreBonusDetail.active),
      spObserved: previous.summary.spObserved + 1, spMatches: previous.summary.spMatches + Number(sp.display === o.game.scoreBonusDetail.special),
      AZPowerUnreported: true, expandedCandidateProspectivePairs: 5,
      expandedCandidateProspectiveMatches: previous.summary.expandedCandidateProspectiveMatches + Number(p.passiveMatches && p.boardMatches) },
    selectedCandidate: { retrospective: '40/40 through AT', prospective: { pairs: 5, matches: 4, ids: ['AW', 'AV', 'AX', 'AY', 'AZ'], failures: ['AX'], distinctMemberSets: 3 },
      combinedEligiblePairs: 45, combinedMatches: previousReport.selectedCandidate.combinedMatches + Number(p.passiveMatches && p.boardMatches), promotedToProduction: false },
    pairedIntervention: { base: 'AZ', treated: 'AX', noelRate: { AZ: 0, AX: 17.8 },
      observedBoardIncrease: Number((10.9 - o.game.scoreBonusDetail.board).toFixed(9)),
      predictedBoardIncrease: Number((ax.selected.board - p.board).toFixed(9)),
      interpretation: 'AX minus AZ observed1.7 versus predicted1.6. The zero-member-timing baseline agrees; the residual appears when the requested Noel rate nodes are applied. This localizes the discrepancy under these inputs but does not uniquely identify probability precision, overlap normalization, judgment interaction or the exact game formula.' },
    provenance: { observationPath, observationSHA256: hash(observationPath), checkpoint: o.predictionCheckpoint, checkpointSHA256: o.predictionCheckpointSHA256,
      previousCatalog, previousCatalogSHA256: hash(previousCatalog), analysisSourceSHA256: hash('analysis/unit-score/compare-az-20260909.mjs'),
      previousComparisonSHA256: hash('analysis/unit-score/reports/AV-AX-AY-comparison-20260909.json') },
    interpretation: { scope: 'AZ all-match confirms the requested four score rows, including passive-row absence. No power/totals or additional board changes are inferred.',
      preMeasurementForecast: true, gitPackagingAfterMeasurement: true, exactFormulaConfirmed: false, unobserved: ['AU'],
      nextResearch: 'Study the Noel activation-rate intervention against the matched zero-timing AX/AZ pair before fitting another candidate. Freeze any future measurement forecast separately.' } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareAZ(), null, 2));
