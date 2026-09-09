import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { collectCatalog } from './compare-am-an-20260909.mjs';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { leaderInterventionFeatures } from './plan-leader-at-20260909.mjs';
import { selectedPrediction, selectedEngine, expandedRows } from './probe-expanded-at-20260909.mjs';
import { model, q, modes } from './expanded-kernel-at-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
import { round1 } from './dummy-model-lab.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
const observationPath = id => `analysis/unit-score/observations/${id}-20260909.json`;
function features(o) {
  const f = o.leaderSupportOverride == null ? allocationFeatures(o) : leaderInterventionFeatures(o);
  return { ...f, zero: !f.features.some(m => m.s > 0), observedActive: o.game.scoreBonusDetail.active,
    rawPassiveWasAbsent: o.scoreRowPresence.passive === false };
}
export function compareAVAXAY() {
  const observations = ['AV', 'AX', 'AY'].map(id => read(observationPath(id)));
  const rows = observations.map(features);
  const results = observations.map((o, i) => {
    assert.equal(hash(o.predictionCheckpoint), o.predictionCheckpointSHA256);
    const baseline = read(o.predictionCheckpoint), plan = baseline.plans?.find(p => p.sampleId === o.sampleId) ?? baseline;
    for (const key of ['leaderId', 'memberIds', 'profiles', 'boardOverrides']) assert.deepEqual(o[key], plan[key]);
    const p = selectedPrediction(rows[i]), active = displayedActiveFeatures(o), sp = quantizedSupportSP(active);
    const computed = { active: active.A, special: sp.display, passive: p.passive, board: p.board };
    assert.equal(p.active, active.A);
    for (const [key, value] of Object.entries(computed)) assert.equal(value, plan.prediction[key]);
    const comparisons = Object.entries(computed).map(([key, predicted]) => {
      const rawObserved = o.game.scoreBonusDetail[key];
      const absent = key === 'passive' && o.scoreRowPresence.passive === false;
      const observed = absent ? 0 : rawObserved;
      return { key, predicted, rawObserved, observed, normalizedAbsentRow: absent,
        matches: observed == null ? null : observed === predicted };
    });
    const joint = o.game.scoreBonusDetail.passive == null ? null : Number((o.game.scoreBonusDetail.passive + o.game.scoreBonusDetail.board).toFixed(9));
    const possible = [round1(rows[i].raw), Number((round1(rows[i].raw) + .1).toFixed(9))];
    return { sampleId: o.sampleId, comparisons, selected: p,
      pairMatches: comparisons.filter(c => ['passive', 'board'].includes(c.key)).every(c => c.matches === true),
      joint: { raw: rows[i].raw, observed: joint, possibleDisplays: possible, compatible: joint == null ? null : possible.includes(joint) } };
  });
  const previousCatalog = 'analysis/unit-score/observation-catalog-AW-20260909.json';
  const previous = read(previousCatalog), entries = [...collectCatalog(previousCatalog), ...observations];
  const eligible = [...expandedRows().rows, features(read(observationPath('AW'))), ...rows];
  const roundingAudit = [];
  function audit(config, pool) {
    const values = eligible.map(r => {
      const z = model(r, selectedEngine).sums;
      const a = proportionalAllocation({ ...r, raw: Number(pool(z).toFixed(9)) }, { countMode: 'fractional' });
      return { id: r.id, passive: a.passive + 0, board: a.board + 0,
        matches: (r.zero ? a.passive === 0 : a.passive === r.observedPassive) && a.board === r.observedBoard };
    });
    roundingAudit.push({ config, matches: values.filter(v => v.matches).length,
      AX: values.find(v => v.id === 'AX'), failures: values.filter(v => !v.matches).map(v => v.id) });
  }
  for (const board of modes) for (const active of modes) audit({ endpoints: { board, active } }, z => q(z.BP, board) - q(z.A, active));
  for (const mode of modes) audit({ delta: mode }, z => q(z.BP - z.A, mode));
  const axObservation = observations.find(o => o.sampleId === 'AX'), ax = results.find(r => r.sampleId === 'AX');
  const inputSensitivity = [[17.8, 0, 0], [21.5, 0, 0], [23.5, 0, 0], [17.8, 4, 0], [17.8, 0, 20], [0, 0, 0]].map(([rate, frequency, kanadeRate]) => {
    const o = structuredClone(axObservation);
    o.boardOverrides['chr-00022'] = { rate, cooldown: frequency };
    o.boardOverrides['chr-06002'] = { rate: kanadeRate, cooldown: 0 };
    const p = selectedPrediction(features(o));
    return { noelRate: rate, noelFrequency: frequency, kanadeRate, passive: p.passive, board: p.board };
  });
  const byKey = key => results.flatMap(r => r.comparisons).filter(c => c.key === key && c.matches != null);
  const summary = { ...previous.summary, observations: entries.length,
    distinctMemberSets: new Set(entries.map(e => [...e.memberIds].sort().join(','))).size,
    activeObserved: previous.summary.activeObserved + byKey('active').length,
    activeMatches: previous.summary.activeMatches + byKey('active').filter(c => c.matches).length,
    spObserved: previous.summary.spObserved + byKey('special').length,
    spMatches: previous.summary.spMatches + byKey('special').filter(c => c.matches).length,
    positivePassiveJointCompatibility: previous.summary.positivePassiveJointCompatibility + results.filter(r => r.joint.compatible === true).length,
    prospectiveJointChecks: [...previous.summary.prospectiveJointChecks, 'AV', 'AY'],
    AXActiveSPConfirmedInFollowUp: true, AVAXAYPowerUnreported: true,
    expandedCandidateProspectivePairs: 4,
    expandedCandidateProspectiveMatches: previous.summary.expandedCandidateProspectiveMatches + results.filter(r => r.pairMatches).length };
  return { schemaVersion: 1, latestObserved: ['AV', 'AX', 'AY'], observations, results, summary,
    selectedCandidate: { retrospective: { through: 'AT', pairs: 40, matches: 40 },
      prospective: { ids: ['AW', 'AV', 'AX', 'AY'], pairs: 4, matches: summary.expandedCandidateProspectiveMatches, failures: ['AX'], distinctMemberSets: 3 },
      combinedEligiblePairs: eligible.length, combinedMatches: eligible.map(r => selectedPrediction(r)).filter(p => p.passiveMatches && p.boardMatches).length,
      promotedToProduction: false },
    diagnostics: { postObservationOnly: true, roundingAudit: { settings: roundingAudit.length, eligiblePairs: eligible.length, variants: roundingAudit },
      AX: { noScoreSupportPassive: rows.find(r => r.id === 'AX').zero, rawActive: ax.selected.sums.A, rawBoardApplied: ax.selected.sums.BP,
        rawDifference: ax.selected.sums.BP - ax.selected.sums.A,
        boardAppliedIncreaseNeededWithFixedActiveEndpoint: q(ax.selected.sums.BP) - ax.selected.sums.BP,
        inputSensitivity, interpretation: 'No positive-passive allocation is present. These input alternatives are diagnostics, not inferred corrections. The user subsequently confirmed the prescribed boards and active/SP; no independent card-level audit was supplied. Final-rounding checks keep the frozen intermediate engine and weights fixed; they are not an exhaustive search of game formulas.' } },
    interpretation: { confirmationScope: 'AV/AY confirm four score rows. AX initial reply confirms absent passive row and board10.9; follow-up confirms active68.9/SP37.5 and board settings. No new power rows, score totals or played-song results.',
      timingEvidence: 'AW-to-AY predicted passive+board display16.0 to19.0 when Watame timing boards are disabled; both endpoints confirmed. This supports timing-overlap modeling, not improvement to actual song scores.',
      exactFormulaConfirmed: false, unobserved: ['AU'], next: 'Isolate a board contribution using the AX zero-passive composition; freeze any next prediction before requesting measurement.' },
    provenance: { previousCatalog, previousCatalogSHA256: hash(previousCatalog),
      observations: Object.fromEntries(observations.map(o => [observationPath(o.sampleId), hash(observationPath(o.sampleId))])),
      analysisSourceSHA256: hash('analysis/unit-score/compare-av-ax-ay-20260909.mjs'),
      modelSourceSHA256: hash('analysis/unit-score/probe-expanded-at-20260909.mjs'),
      kernelSourceSHA256: hash('analysis/unit-score/expanded-kernel-at-20260909.mjs') } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareAVAXAY(), null, 2));
