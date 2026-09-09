import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { compareAP } from './compare-ap-20260909.mjs';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
import { round1 } from './dummy-model-lab.mjs';
const root = new URL('../../', import.meta.url);
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');

export function planAQ() {
  const previous = compareAP();
  const o = { sampleId: 'AQ', leaderId: previous.observation.leaderId, memberIds: previous.observation.memberIds,
    profiles: previous.observation.profiles,
    boardOverrides: { ...previous.observation.boardOverrides, 'chr-00022': { rate: 21.5, cooldown: 0 } } };
  const f = displayedActiveFeatures(o), sp = quantizedSupportSP(f), features = allocationFeatures(o);
  const finite = proportionalAllocation(features), continuous = proportionalAllocation(features, { countMode: 'fractional' });
  const fitted405 = proportionalAllocation(features, { duration: 405 });
  assert.equal(finite.passive, 2.4); assert.equal(continuous.passive, 2.3);
  assert.equal(finite.board, 12); assert.equal(continuous.board, 12);
  return { schemaVersion: 1, ...o, status: 'Planned; no AQ measurement received', observationsReceived: [],
    intervention: 'Keep AP formation. Kanade15%/5% and Noel frequency4% remain OFF. Disable only Noel activation-rate2% node; retain Noel3.7%+11.1%+3.7%+3%=21.5%, Flare6% and all Ririka leader nodes. Keep all other conditions unchanged.',
    baselineValues: { memberParameter: f.power.memberParameter, outfitPower: f.power.outfit, passivePower: f.power.passive, active: f.A, special: sp.display },
    hypotheses: { finite200: { passive: finite.passive, board: finite.board, rawPassive: finite.rawPassive, rawBoard: finite.rawBoard },
      fractionalCount: { passive: continuous.passive, board: continuous.board, rawPassive: continuous.rawPassive, rawBoard: continuous.rawBoard },
      retrospective405: { passive: fitted405.passive, board: fitted405.board,
        meaning: 'Diagnostic comparator only; not selected as an internal duration. AQ cannot distinguish405 from200.' },
      joint: { raw: features.raw, possibleDisplays: [round1(features.raw), Number((round1(features.raw) + .1).toFixed(9))] } },
    features,
    selection: { design: 'Read-only enumeration of32 subsets of Noel five rate nodes, crossed with Flare rate6% ON/OFF, retaining AP frequency/other boards. Among64 scenarios this control needs only one node change and separates integer-count from fractional-count weights.',
      outcomeUse: 'No AQ outcome was used to choose the control. Selecting a scenario where hypotheses disagree is prospective experimental design.',
      thresholdCaveat: 'Raw passive2.302481 versus2.296877 straddles2.3 narrowly; a match discriminates these exact inputs/formulas, not all possible hidden-precision implementations.' },
    decisions: { passive24board120: 'Support frozen finite-count prediction against this fractional-count alternative; historical failures still remain.',
      passive23board120: 'Reject frozen finite200 prediction at this input; investigate weighting or intermediate precision. Do not silently refit.',
      neither: 'Preserve failure and inspect node scope and formula together.',
      baselineChanges: 'Check formation/node side effects; leave unreported fields missing.' },
    requestedMeasurements: 'Passive and board score rows; Active/SP if visible. Note any additional nodes or other effects that turn off.',
    provenance: { observationPath: 'analysis/unit-score/observations/AP-20260909.json', observationSHA256: hash('analysis/unit-score/observations/AP-20260909.json'),
      reportPath: 'analysis/unit-score/reports/AP-comparison-20260909.json', reportSHA256: hash('analysis/unit-score/reports/AP-comparison-20260909.json'),
      sourceHashes: previous.provenance.sourceHashes, probeSourceSHA256: previous.provenance.probeSourceSHA256,
      analysisSourceSHA256: hash('analysis/unit-score/plan-rate-aq-20260909.mjs'), productionFormulaChanged: false } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planAQ(), null, 2));
