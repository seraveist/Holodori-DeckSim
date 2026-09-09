import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compareAO } from './compare-ao-20260909.mjs';
import { allocationFeatures, proportionalAllocation, probeProportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
import { round1 } from './dummy-model-lab.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function planAP() {
  const previous = compareAO(), probe = probeProportionalAllocation();
  const o = { sampleId: 'AP', leaderId: previous.observation.leaderId, memberIds: previous.observation.memberIds,
    profiles: previous.observation.profiles,
    boardOverrides: { ...previous.observation.boardOverrides, 'chr-00022': { rate: 23.5, cooldown: 0 } } };
  const f = displayedActiveFeatures(o), sp = quantizedSupportSP(f), features = allocationFeatures(o), prediction = proportionalAllocation(features);
  assert.equal(prediction.passive, 2.3);
  assert.equal(prediction.board, 12.1);
  const report = 'analysis/unit-score/reports/proportional-allocation-AO-20260909.json';
  assert.deepEqual(probe, read(report));
  return { schemaVersion: 1, ...o, status: 'Planned; no AP measurement received', observationsReceived: [],
    intervention: 'From AO, keep Kanade15%/5% OFF. Disable only Noel activation-frequency4%; retain Noel activation-rate23.5%, Flare6% and all Ririka leader nodes. All cards, growth, order and pre-song context stay fixed.',
    baselineValues: { memberParameter: f.power.memberParameter, outfitPower: f.power.outfit, passivePower: f.power.passive, active: f.A, special: sp.display },
    hypotheses: { proportionalAllocation: { passive: prediction.passive, board: prediction.board,
      status: 'First future prediction of the new proportional family; not a confirmed general formula.' },
      joint: { raw: features.raw, possibleDisplays: [round1(features.raw), Number((round1(features.raw) + .1).toFixed(9))] } },
    features, prediction,
    interpretation: 'Counterintuitive test: the current200-second model predicts that disabling this frequency node increases the displayed combined bonus, because Active overlap timing changes. This is not a claim that lowering frequency improves actual song scores.',
    decisions: { bothMatch: 'One prospective success for this formula after selection. Four historical discrepancies still block a general exact-allocation claim.',
      splitFailsButSumMatches: 'Reject the frozen individual prediction; keep combined evidence separate.',
      sumFails: 'Revisit time-window/board-frequency modeling before refining attribution.',
      baselineChanges: 'Check formation and node scope; Active/SP/power were predicted unchanged, not pre-confirmed.' },
    requestedMeasurements: 'Passive and board score rows, Active/SP and the three baseline power rows when available. Note any extra node changes.',
    provenance: { observationPath: 'analysis/unit-score/observations/AO-20260909.json', observationSHA256: hash('analysis/unit-score/observations/AO-20260909.json'),
      probeReport: report, probeReportSHA256: hash(report), sourceHashes: probe.provenance.sourceHashes,
      probeSourceSHA256: probe.provenance.analysisSourceSHA256, analysisSourceSHA256: hash('analysis/unit-score/plan-frequency-ap-20260909.mjs'), predictionsAndProductionUnchanged: true } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planAP(), null, 2));
