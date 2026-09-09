import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { roundedAllocation, probeRoundedAllocation } from './probe-rounded-allocation-aq-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function planAR() {
  const observationPath = 'analysis/unit-score/observations/AQ-20260909.json';
  const previous = read(observationPath), probe = probeRoundedAllocation();
  const probeReport = 'analysis/unit-score/reports/rounded-allocation-AQ-20260909.json';
  assert.deepEqual(probe, read(probeReport));
  const o = { sampleId: 'AR', leaderId: previous.leaderId, memberIds: previous.memberIds, profiles: previous.profiles,
    boardOverrides: { ...previous.boardOverrides, 'chr-00022': { rate: 14.1, cooldown: 0 } } };
  const f = displayedActiveFeatures(o), sp = quantizedSupportSP(f), features = allocationFeatures(o), prediction = roundedAllocation(features);
  const rawFractional = proportionalAllocation(features, { countMode: 'fractional' }), rawFinite = proportionalAllocation(features);
  assert.equal(prediction.passive, 2.5); assert.equal(prediction.board, 11.4);
  assert.equal(rawFractional.passive, 2.5); assert.equal(rawFractional.board, 11.5);
  return { schemaVersion: 1, ...o, status: 'Planned; no AR measurement received', observationsReceived: [],
    intervention: 'From AQ disable both Noel activation-rate3.7% nodes. Noel rate2% and frequency4% remain OFF; retain Noel11.1%+3%=14.1%, Kanade15%/5% OFF, Flare6% and all Ririka leader nodes. Keep the same cards, growth, order and view.',
    baselineValues: { memberParameter: f.power.memberParameter, outfitPower: f.power.outfit, passivePower: f.power.passive, active: f.A, special: sp.display },
    hypotheses: { roundedFractional: { passive: prediction.passive, board: prediction.board, roundedIncrement: prediction.roundedIncrement },
      rawFractional: { passive: rawFractional.passive, board: rawFractional.board },
      rejectedRawFinite: { passive: rawFinite.passive, board: rawFinite.board },
      predictedVisibleScoreTotal: Number((f.A + sp.display + prediction.passive + prediction.board).toFixed(9)) },
    features, prediction,
    selection: { scenarios: 32, design: 'Noel remaining four rate-node subsets crossed with Flare6% ON/OFF, starting from AQ. Turning off both3.7% nodes separates rounded-increment from both raw-increment candidates using two node changes.',
      independentStatus: 'First prospective measurement after selecting the rounded-allocation formula; no AR result used.',
      ambiguity: 'This control does not distinguish rounding both totals upward from rounding both downward. It also cannot prove an internal duration.' },
    decisions: { match: 'One prospective success for the rounded model, separate from26 retrospective fits.',
      board115: 'Reject new rounded board prediction and preserve the failure.',
      other: 'Record all rows and check node side effects before revising any model.' },
    requestedMeasurements: 'Passive and board score rows, plus Active/SP if visible. Record any additional node or power/stat changes.',
    provenance: { observationPath, observationSHA256: hash(observationPath), probeReport, probeReportSHA256: hash(probeReport),
      probeSourceSHA256: probe.provenance.analysisSourceSHA256, sourceHashes: probe.provenance.sourceHashes,
      analysisSourceSHA256: hash('analysis/unit-score/plan-rounded-ar-20260909.mjs'), productionFormulaChanged: false } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planAR(), null, 2));
