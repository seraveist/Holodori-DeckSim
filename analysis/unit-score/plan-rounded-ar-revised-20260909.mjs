import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { planAR } from './plan-rounded-ar-20260909.mjs';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { roundedAllocation } from './probe-rounded-allocation-aq-20260909.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function planARRevised() {
  const originalPlan = 'analysis/unit-score/experiments/baseline-rounded-AR-20260909.json';
  const original = planAR();
  assert.deepEqual(original, read(originalPlan));
  const constraintPath = 'analysis/unit-score/board-observations/noel-node-dependency-20260909.json';
  const constraint = read(constraintPath);
  assert.equal(constraint.initialARExecuted, false);
  const o = { sampleId: 'AR', leaderId: original.leaderId, memberIds: original.memberIds, profiles: original.profiles,
    boardOverrides: { ...original.boardOverrides, 'chr-00022': { rate: 17.8, cooldown: 0 } } };
  const features = allocationFeatures(o), prediction = roundedAllocation(features), raw = proportionalAllocation(features, { countMode: 'fractional' });
  assert.equal(prediction.passive, 2.4); assert.equal(prediction.board, 11.7);
  assert.equal(raw.passive, 2.4); assert.equal(raw.board, 11.8);
  return { schemaVersion: 1, ...o, revision: 2, status: 'Revised plan; no AR measurement received', observationsReceived: [],
    intervention: 'From AQ disable only the single Noel3.7% rate node that can be disabled without other effects. Retain the other3.7%,11.1%,3%=17.8%. Noel2% and frequency4% remain OFF. Kanade15%/5% remain OFF; Flare6% and all Ririka leader nodes remain unchanged.',
    baselineValues: original.baselineValues,
    hypotheses: { roundedFractional: { passive: prediction.passive, board: prediction.board, roundedIncrement: prediction.roundedIncrement },
      rawFractional: { passive: raw.passive, board: raw.board },
      predictedVisibleScoreTotal: Number((original.baselineValues.active + original.baselineValues.special + prediction.passive + prediction.board).toFixed(9)) },
    features, prediction,
    revisionReason: 'User reported node dependency before any AR score measurement. Original two-node-only control is infeasible; the one-node revision still separates the rounded and raw fractional models.',
    independentStatus: 'First prospective test for the new rounded formula. The constraint response supplies no outcome and is not a validation observation.',
    requestedMeasurements: 'Passive/board score, Active/SP if visible, and any extra node effects that changed.',
    provenance: { originalPlan, originalPlanSHA256: hash(originalPlan), constraintPath, constraintSHA256: hash(constraintPath),
      observationPath: original.provenance.observationPath, observationSHA256: original.provenance.observationSHA256,
      probeReport: original.provenance.probeReport, probeReportSHA256: original.provenance.probeReportSHA256,
      sourceHashes: original.provenance.sourceHashes, probeSourceSHA256: original.provenance.probeSourceSHA256,
      analysisSourceSHA256: hash('analysis/unit-score/plan-rounded-ar-revised-20260909.mjs'), productionFormulaChanged: false } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planARRevised(), null, 2));
