import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { interventionEnvironment } from './board-intervention-20260909.mjs';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { integrate, round1 } from './dummy-model-lab.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function leaderInterventionFeatures(o) {
  assert.ok(Number.isFinite(o.leaderSupportOverride) && o.leaderSupportOverride >= 0);
  const e = interventionEnvironment(o, o.boardOverrides), base = allocationFeatures(o);
  const Braw = integrate(e.adjusted, { outfit: o.leaderSupportOverride });
  const BPraw = integrate(e.adjusted, { outfit: o.leaderSupportOverride, passive: true });
  return { ...base, Braw, BPraw, raw: BPraw - base.Araw,
    features: base.features.map(m => ({ ...m, L: o.leaderSupportOverride })) };
}
export function planAT() {
  const observationPath = 'analysis/unit-score/observations/AS-20260909.json', previous = read(observationPath);
  const o = { sampleId: 'AT', leaderId: previous.leaderId, memberIds: previous.memberIds, profiles: previous.profiles,
    boardOverrides: previous.boardOverrides, leaderSupportOverride: 10.2 };
  const features = leaderInterventionFeatures(o), prediction = proportionalAllocation(features, { countMode: 'fractional' });
  assert.ok(features.features.every(m => m.r === 0 && m.f === 0 && m.L === 10.2));
  assert.equal(prediction.passive, 3); assert.equal(prediction.board, 7.8);
  const direct = { passive: round1(features.BPraw - features.Braw), board: round1(features.Braw - features.Araw) };
  assert.equal(direct.passive, 3); assert.equal(direct.board, 7.7);
  return { schemaVersion: 1, ...o, status: 'Planned; no AT measurement received', observationsReceived: [],
    intervention: 'Keep AS members/profiles and every member rate/frequency board OFF. Disable only Ririka leader score-support3.1% node, retaining6.2%+4.0%=10.2% and all other effects. If this cannot be done alone, report the dependency before treating the result as AT.',
    baselineValues: read('analysis/unit-score/experiments/baseline-no-timing-AS-20260909.json').baselineValues,
    hypotheses: { rawProportional: { passive: prediction.passive, board: prediction.board }, directMarginal: direct,
      joint: { raw: features.raw, possibleDisplays: [round1(features.raw), Number((round1(features.raw) + .1).toFixed(9))] } },
    features, prediction,
    purpose: 'Change only uniform leader support in the zero member timing baseline. This tests whether AS attribution behavior persists at another leader coefficient without fractional member timing inputs.',
    requestedMeasurements: 'Passive/board, Active/SP when visible, and whether any extra effects must also turn off.',
    provenance: { observationPath, observationSHA256: hash(observationPath),
      precedingReport: 'analysis/unit-score/reports/AS-comparison-20260909.json', precedingReportSHA256: hash('analysis/unit-score/reports/AS-comparison-20260909.json'),
      sourceHashes: read('analysis/unit-score/reports/AS-comparison-20260909.json').provenance.sourceHashes,
      analysisSourceSHA256: hash('analysis/unit-score/plan-leader-at-20260909.mjs'), productionFormulaChanged: false } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planAT(), null, 2));
