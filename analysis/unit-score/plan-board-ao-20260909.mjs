import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compareAMAN } from './compare-am-an-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
import { interventionEnvironment, interventionValues } from './board-intervention-20260909.mjs';
import { condition } from './dummy-model-lab.mjs';
import { sourceLock } from './io.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');

export function planAO() {
  const previous = compareAMAN();
  const previousReport = 'analysis/unit-score/reports/AM-AN-comparison-20260909.json';
  assert.deepEqual(previous, read(previousReport));
  const capability = 'analysis/unit-score/board-observations/toggle-availability-20260909.json';
  assert.equal(read(capability).costFreeDeactivationAvailable, true);
  const basePath = 'analysis/unit-score/observations/AN-20260909.json';
  const referencePath = 'analysis/unit-score/observations/AM-20260909.json';
  const base = read(basePath), reference = read(referencePath);
  const o = { sampleId: 'AO', leaderId: base.leaderId, memberIds: base.memberIds, profiles: base.profiles };
  const overrides = { 'chr-06002': { rate: 0, cooldown: 0 } };
  const f = displayedActiveFeatures(o), sp = quantizedSupportSP(f);
  const before = interventionValues(base), after = interventionValues(o, overrides), am = interventionValues(reference);
  assert.equal(before.raw, previous.rows[1].joint.rawCombined);
  assert.equal(after.raw, am.raw);
  const signature = e => e.adjusted.members.map((m, i) => ({ active: m.active,
    effectiveValue: condition(m.active.condition, e.adjusted) ? m.active.conditionalScoreUp : m.active.baseScoreUp,
    passiveSupport: e.adjusted.support[i] }));
  assert.deepEqual(signature(interventionEnvironment(o, overrides)), signature(interventionEnvironment(reference)));
  const baselineValues = { memberParameter: f.power.memberParameter, outfitPower: f.power.outfit,
    passivePower: f.power.passive, active: f.A, special: sp.display };
  assert.deepEqual(baselineValues, { memberParameter: 79007, outfitPower: 11859, passivePower: 7816, active: 75.2, special: 43.9 });
  return { schemaVersion: 1, ...o, status: 'Planned; no AO measurement received', observationsReceived: [],
    baselineValues, boardOverrides: overrides, before, after,
    intervention: { from: 'AN', character: 'Kanade', characterId: 'chr-06002',
      activationRateNodesBeforePct: [15, 5], activationRateNodesAfterPct: [], cooldownBeforePct: 0, cooldownAfterPct: 0,
      instruction: 'Keep the AN formation, growth, order, song-selection context, other member boards and Ririka leader boards fixed. Disable only Kanade activation-rate nodes15% and5%.',
      scope: 'Cost-free deactivation confirmed available. If these nodes cannot be disabled independently, document all simultaneous changes before interpreting the result.' },
    controls: { sameCardsAndSPAsAN: true, sameAdjustedActiveAndSupportAsAM: true,
      SPDifferenceFromAM: 'AO keeps Kanade14s/95%; AM has Suisei12s/100%. This residual card difference is not a pure SP intervention.' },
    hypotheses: {
      timingBoardExplainsAMANDifference: { passive: 1.7, board: 9.4,
        kind: 'Conditional equivalence to measured AM when attribution depends on adjusted Active, support and leader inputs. Not a general formula.' },
      invarianceToThisTimingBoard: { passive: 1.6, conditionalBoardDisplays: [9.5, 9.6],
        kind: 'Keep measured AN passive if this board change leaves it invariant; board candidates additionally assume the joint raw model and separate ceiling. Not proof of SP causation.' },
      conditionalJoint: { raw: after.raw, possibleDisplays: after.possibleDisplays,
        kind: 'Frozen existing combined model under a newly controlled board intervention; two-value range, not an exact allocation.' } },
    decisions: { passiveChanges: 'AN->AO isolates the documented timing-board intervention if controls hold. It establishes an effect at displayed precision, not the complete mechanism.',
      passiveUnchanged: 'No detectable effect for this intervention; does not prove universal board independence. AM vs AO retains SP and other card-property differences.',
      baselineChanges: 'Recheck card growth, formation and board scope; the frozen baseline model would fail this board intervention.',
      sumFails: 'Preserve failure; revisit board treatment and combined model instead of fitting an allocation coefficient.' },
    requestedMeasurements: 'Passive and board score rows; Active/SP and the three baseline power rows if available. Record whether only the two Kanade rate nodes changed.',
    provenance: { previousReport, previousReportSHA256: hash(previousReport), basePath, baseSHA256: hash(basePath), referencePath, referenceSHA256: hash(referencePath),
      capability, capabilitySHA256: hash(capability), sourceHashes: sourceLock(),
      analysisSourceSHA256: hash('analysis/unit-score/plan-board-ao-20260909.mjs'),
      interventionSourceSHA256: hash('analysis/unit-score/board-intervention-20260909.mjs'), predictionsAndProductionUnchanged: true } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planAO(), null, 2));
