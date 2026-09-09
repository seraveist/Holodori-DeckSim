import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
import { round1 } from './dummy-model-lab.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function planAS() {
  const observationPath = 'analysis/unit-score/observations/AR-20260909.json', previous = read(observationPath);
  const o = { sampleId: 'AS', leaderId: previous.leaderId, memberIds: previous.memberIds, profiles: previous.profiles,
    boardOverrides: { ...previous.boardOverrides, 'chr-00022': { rate: 0, cooldown: 0 }, 'chr-00021': { rate: 0, cooldown: 0 } } };
  const features = allocationFeatures(o), prediction = proportionalAllocation(features, { countMode: 'fractional' });
  const f = displayedActiveFeatures(o), sp = quantizedSupportSP(f);
  assert.ok(features.features.every(m => m.r === 0 && m.f === 0 && m.L === 13.3));
  assert.equal(prediction.passive, 3); assert.equal(prediction.board, 10.1);
  const directPassive = round1(features.BPraw - features.Braw), directBoard = round1(features.Braw - features.Araw);
  assert.equal(directPassive, 3); assert.equal(directBoard, 10);
  return { schemaVersion: 1, ...o, status: 'Planned; no AS measurement received', observationsReceived: [],
    intervention: 'Keep revised AR cards and profiles. Disable all remaining Noel rate nodes3.7%,11.1%,3.0% and Flare rate6%. Kanade rates and Noel frequency stay OFF. Retain all Ririka leader nodes and all unrelated effects. Report any dependency-driven additional changes.',
    baselineValues: { memberParameter: f.power.memberParameter, outfitPower: f.power.outfit, passivePower: f.power.passive, active: f.A, special: sp.display },
    hypotheses: { rawProportional: { passive: prediction.passive, board: prediction.board },
      directMarginal: { passive: directPassive, board: directBoard },
      joint: { raw: features.raw, possibleDisplays: [round1(features.raw), Number((round1(features.raw) + .1).toFixed(9))] } },
    features, prediction,
    purpose: 'Remove member timing-board inputs entirely; compare attribution when the only modeled numeric board effect is uniform leader support13.3%. This removes ambiguity from fractional timing-board node values and their cycle overlap. Ririka judgment and other unmodeled effects are not claimed removed.',
    decisions: { passive30board101: 'Supports proportional attribution against this direct-marginal baseline, not a general formula.',
      passive30board100: 'Supports direct-marginal baseline at this control; reassess attribution when member timing is present.',
      other: 'Preserve result and inspect node scope and unmodeled leader effects; do not refit a duration.' },
    requestedMeasurements: 'Passive and board score, Active/SP when visible, and any other effects disabled by node dependencies. Do not count missing values as matches.',
    provenance: { observationPath, observationSHA256: hash(observationPath),
      precedingReport: 'analysis/unit-score/reports/AR-comparison-20260909.json', precedingReportSHA256: hash('analysis/unit-score/reports/AR-comparison-20260909.json'),
      sourceHashes: read('analysis/unit-score/reports/AR-comparison-20260909.json').provenance.sourceHashes,
      featureSourceSHA256: hash('analysis/unit-score/probe-proportional-allocation-20260909.mjs'),
      analysisSourceSHA256: hash('analysis/unit-score/plan-no-timing-as-20260909.mjs'), productionFormulaChanged: false } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planAS(), null, 2));
