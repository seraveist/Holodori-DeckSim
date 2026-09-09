import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compareALAndPlanPair } from './compare-al-plan-am-an-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
import { numericBoardResearch } from './compare-board-ae-20260909.mjs';
import { sourceLock } from './io.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
const clean = x => Number(x.toFixed(9));
const sum = values => clean(values.reduce((s, v) => s + v, 0));

export function collectCatalog(p) {
  const c = read(p);
  if (!c.extendsCatalog) return c.observations;
  assert.equal(hash(c.extendsCatalog), c.extendsCatalogSHA256);
  return [...collectCatalog(c.extendsCatalog), ...c.observations];
}

export function compareAMAN() {
  const checkpoint = 'analysis/unit-score/experiments/baseline-passive-AM-AN-20260909.json';
  const parentCatalog = 'analysis/unit-score/observation-catalog-AL-20260909.json';
  const plan = read(checkpoint), previous = compareALAndPlanPair();
  assert.deepEqual(plan, { ...previous.next, provenance: previous.provenance });
  const observationPaths = plan.experimentIds.map(id => `analysis/unit-score/observations/${id}-20260909.json`);
  const observations = observationPaths.map(read);
  const rows = observations.map((o, i) => {
    const p = plan.plans[i];
    assert.equal(o.sampleId, p.sampleId);
    assert.equal(o.predictionCheckpointSHA256, hash(checkpoint));
    assert.equal(o.leaderId, p.leaderId);
    assert.deepEqual(o.memberIds, p.memberIds);
    assert.deepEqual(o.profiles, p.profiles);
    assert.equal(hash(o.screenshot.path), o.screenshot.sha256);
    assert.equal(o.screenshot.attachmentIndex, i + 1);
    const f = displayedActiveFeatures(o), sp = quantizedSupportSP(f), b = numericBoardResearch(o);
    assert.equal(b.excluded, false);
    const recalculated = { memberParameter: f.power.memberParameter, outfitPower: f.power.outfit,
      passivePower: f.power.passive, active: f.A, special: sp.display };
    assert.deepEqual(recalculated, p.baselineValues);
    const actual = { memberParameter: o.game.powerDetail.memberParameter, outfitPower: o.game.powerDetail.outfit,
      passivePower: o.game.powerDetail.passive, ...o.game.scoreBonusDetail };
    const comparisons = Object.entries(p.baselineValues).map(([item, predicted]) => ({ item, predicted,
      observed: actual[item], matches: predicted === actual[item] }));
    const powerSum = sum(Object.values(o.game.powerDetail));
    const scoreRowsSum = sum(Object.values(o.game.scoreBonusDetail).filter(v => v !== null));
    const P = actual.passive, B = actual.board, S = b.joint.rawCombined;
    // Conditional on S being the true raw sum and each displayed row being ceil0.1:
    // Praw belongs to (P-.1,P] intersect [S-B,S-B+.1). These samples have closed extrema.
    assert.ok(S - B > P - .1 && P < S - B + .1);
    const interval = [S - B, P];
    const marginal = b.BPraw - b.Braw;
    assert.ok(marginal > 0);
    return { sampleId: o.sampleId, comparisons, observedScoreRows: o.game.scoreBonusDetail,
      arithmetic: { powerSum, reportedOverallPower: o.game.overallPower, powerSumMatches: powerSum === o.game.overallPower,
        scoreRowsSum, reportedScoreBonus: o.game.scoreBonusPct, scoreRowsSumMatches: scoreRowsSum === o.game.scoreBonusPct,
        retainedPower: f.retainedPower, finalUnitScore: o.game.unitScore },
      joint: { ...b.joint, frozenPossibleDisplays: p.conditionalJoint.possibleDisplays },
      allocationResearch: { Araw: b.Araw, Braw: b.Braw, BPraw: b.BPraw, marginal,
        differenceOfCeilPassive: b.passiveMarginalReference,
        conditionalPassiveRawInterval: { min: interval[0], max: interval[1], minInclusive: true, maxInclusive: true },
        conditionalMarginalMultiplierInterval: { min: interval[0] / marginal, max: interval[1] / marginal,
          minInclusive: true, maxInclusive: true } } };
  });
  const [am, an] = rows;
  const delta = Object.fromEntries(['active', 'special', 'passive', 'board'].map(k => [k,
    clean(an.observedScoreRows[k] - am.observedScoreRows[k])]));
  delta.joint = clean(an.joint.reportedSum - am.joint.reportedSum);
  delta.totalScoreBonus = clean(an.arithmetic.reportedScoreBonus - am.arithmetic.reportedScoreBonus);
  const intervals = rows.map(r => r.allocationResearch.conditionalMarginalMultiplierInterval);
  const multiplierIntersection = { min: Math.max(...intervals.map(i => i.min)), max: Math.min(...intervals.map(i => i.max)) };
  multiplierIntersection.empty = multiplierIntersection.min > multiplierIntersection.max;
  const entries = [...collectCatalog(parentCatalog), ...observations.map(o => ({ ...o, rawGame: o.game }))];
  const powerFields = ['memberParameter', 'outfit', 'passive'];
  const summary = { ...previous.summary, observations: entries.length,
    distinctMemberSets: new Set(entries.map(o => [...o.memberIds].sort().join(','))).size,
    activeObserved: entries.filter(o => o.rawGame.scoreBonusDetail.active !== null).length,
    activeMatches: previous.summary.activeMatches + rows.filter(r => r.comparisons.find(c => c.item === 'active').matches).length,
    spObserved: entries.filter(o => o.rawGame.scoreBonusDetail.special !== null).length,
    spMatches: previous.summary.spMatches + rows.filter(r => r.comparisons.find(c => c.item === 'special').matches).length,
    confirmedPowerComponents: entries.reduce((s, e) => s + powerFields.filter(k => e.rawGame.powerDetail[k] !== null).length, 0),
    positivePassiveJointCompatibility: previous.summary.positivePassiveJointCompatibility + rows.filter(r => r.joint.compatible).length,
    prospectiveJointChecks: [...previous.summary.prospectiveJointChecks, ...plan.experimentIds] };
  return { schemaVersion: 1, latestObserved: 'AN', observationsReceived: ['AM', 'AN'], nextUnobserved: [],
    rows, summary, deltaANMinusAM: delta,
    frozenRelationshipTest: { ...plan.relationshipHypothesis, observedPassiveDifference: delta.passive,
      matches: delta.passive === plan.relationshipHypothesis.passiveDifference,
      conclusion: 'Rejected: equal base Active/support/leader inputs did not preserve displayed passive. No individual passive or board value was predicted.' },
    conditionalAllocation: { assumptions: ['The existing BPraw-Araw model is the exact sum of the two raw categories.',
      'Each category is independently rounded upward to one decimal place. Neither assumption is proved by range compatibility.'],
      passiveRawDeltaInterval: { min: an.allocationResearch.conditionalPassiveRawInterval.min - am.allocationResearch.conditionalPassiveRawInterval.max,
        max: an.allocationResearch.conditionalPassiveRawInterval.max - am.allocationResearch.conditionalPassiveRawInterval.min,
        minInclusive: true, maxInclusive: true },
      marginalMultiplierIntersection: multiplierIntersection,
      conclusion: 'Under both assumptions, even this pair excludes one constant multiplier of BPraw-Braw. Without the raw-sum assumption the pair alone does not exclude every multiplier.' },
    interpretation: { supported: 'Both frozen baseline tables match and both frozen joint candidate sets contain the observed sums. Passive display invariance fails.',
      unidentified: plan.confounders,
      nextPriority: 'Test allocation candidates against all recorded observations, then freeze a discriminating single-factor control. AM/AN do not identify board vs SP causation.',
      nextPlan: null, productionFormulaChanged: false, generalAllocationFormulaConfirmed: false },
    provenance: { checkpoint, checkpointSHA256: hash(checkpoint), parentCatalog, parentCatalogSHA256: hash(parentCatalog),
      observations: observationPaths.map(path => ({ path, sha256: hash(path) })),
      screenshots: observations.map(o => o.screenshot), sourceHashes: sourceLock(),
      analysisSourceSHA256: hash('analysis/unit-score/compare-am-an-20260909.mjs'), predictionsAndProductionUnchanged: true } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(compareAMAN(), null, 2));
