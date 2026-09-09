import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { compareAJAndPlanAK } from '../analysis/unit-score/compare-passive-aj-20260909.mjs';
import { sourceLock } from '../analysis/unit-score/io.mjs';

const root = new URL('../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
const importFolder = 'analysis/unit-score/imports/20260909-aj/';

export function verifyAJHandoff() {
  const record = read(`${importFolder}import-record.json`);
  assert.equal(hash(`${importFolder}source-package-manifest.json`), record.sourceManifestSHA256);
  for (const f of record.frozenResearch) {
    assert.ok(!path.isAbsolute(f.path) && !f.path.split(/[\\/]/).includes('..'));
    assert.equal(hash(f.path), f.sha256, `Frozen research bytes changed: ${f.path}`);
  }
  const plan = read('analysis/unit-score/experiments/baseline-passive-AK-20260909.json');
  assert.deepEqual(sourceLock(), plan.sourceHashes);
  for (const [p, h] of Object.entries({ ...plan.newEvidenceHashes, ...plan.observationHashes, ...plan.previousSourceLocks })) assert.equal(hash(p), h, p);
  assert.equal(hash('analysis/unit-score/compare-passive-aj-20260909.mjs'), plan.analysisSourceSHA256);
  assert.equal(hash('analysis/unit-score/experiments/baseline-passive-AJ-20260909.json'), plan.AJCheckpointSHA256);

  const result = compareAJAndPlanAK();
  assert.deepEqual(result.next.features.power, plan.features.power);
  assert.deepEqual(result.next.profiles, plan.profiles);
  assert.deepEqual(result.next.hypotheses, plan.hypotheses);
  assert.equal(result.candidateComparisons.filter(c => c.matches).length, 0);
  assert.equal(result.summary.observations, 34);
  assert.equal(result.summary.distinctMemberSets, 21);
  const catalog = read('analysis/unit-score/observation-catalog-20260909.json');
  assert.equal(catalog.observations.length, 34);
  assert.deepEqual(catalog.observations.map(o => o.sampleId), result.rows.map(r => r.id));
  let confirmedPowerComponents = 0;
  for (const o of catalog.observations) {
    const f = result.rows.find(r => r.id === o.sampleId);
    const source = read(o.sourcePath);
    const raw = o.initialFixtureIndex == null ? source : source.observations[o.initialFixtureIndex];
    assert.equal(hash(o.sourcePath), o.sourceSHA256, `${o.sampleId}: source provenance`);
    assert.deepEqual(o.rawGame, raw.game, `${o.sampleId}: catalog must retain raw missing values`);
    assert.deepEqual(o.memberIds, raw.memberIds);
    assert.deepEqual(o.memberIds, f.memberIds);
    assert.equal(o.rawGame.scoreBonusDetail.active, f.A);
    assert.equal(o.rawGame.scoreBonusDetail.special, f.quantized.display);
    for (const key of ['memberParameter', 'outfit', 'passive']) {
      const observed = o.rawGame.powerDetail[key];
      if (observed !== null && observed !== undefined) {
        assert.equal(f.power[key], observed, `${o.sampleId}: ${key}`);
        confirmedPowerComponents++;
      }
    }
    assert.equal(o.rawGame.unitScore, null, `${o.sampleId}: no directly observed final Unit Score`);
  }
  assert.ok(!catalog.observations.some(o => ['L', 'N', 'AK'].includes(o.sampleId)));
  assert.equal(catalog.observations.filter(o => o.sampleId === 'Z').length, 1);
  for (const id of ['AC', 'AD', 'AE']) assert.equal(catalog.observations.find(o => o.sampleId === id).rawGame.scoreBonusDetail.passive, null);
  assert.equal(catalog.observations.find(o => o.sampleId === 'AJ').rawGame.overallPower, null);
  assert.equal(catalog.observations.find(o => o.sampleId === 'AJ').rawGame.scoreBonusPct, null);
  assert.equal(confirmedPowerComponents, 88);
  assert.equal(result.summary.activeMatches, 34);
  assert.equal(result.summary.refinedSPMatches, 34);
  assert.equal(result.extensionAudit.positivePassive.jointCompatible, 19);
  return { status: 'PASS', latestObserved: 'AJ', nextUnobserved: 'AK', frozenResearchFiles: record.frozenResearch.length,
    observations: 34, distinctMemberSets: 21, activeMatches: result.summary.activeMatches,
    spMatches: result.summary.refinedSPMatches, confirmedPowerComponents,
    positivePassiveJointCompatibility: result.extensionAudit.positivePassive.jointCompatible,
    AJBothFrozenCandidatesStillFail: true, individualPassiveFormulaConfirmed: false,
    AK: { memberParameter: plan.features.power.memberParameter, outfitPower: plan.features.power.outfit,
      passivePower: plan.features.power.passive, active: plan.features.A, special: plan.quantized.display,
      passiveInvarianceHypothesis: plan.hypotheses.passive.display, boardInvarianceHypothesis: plan.hypotheses.board.display } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(verifyAJHandoff(), null, 2));
