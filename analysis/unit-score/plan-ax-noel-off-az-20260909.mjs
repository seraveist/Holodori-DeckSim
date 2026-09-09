import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { leaderInterventionFeatures } from './plan-leader-at-20260909.mjs';
import { selectedPrediction } from './probe-expanded-at-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
const root = new URL('../../', import.meta.url);
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function planAZ() {
  const source = 'analysis/unit-score/observations/AX-20260909.json';
  const o = JSON.parse(fs.readFileSync(new URL(source, root), 'utf8'));
  o.sampleId = 'AZ';
  o.boardOverrides['chr-00022'] = { rate: 0, cooldown: 0 };
  o.game.scoreBonusDetail = { active: null, special: null, passive: null, board: null, outfit: null };
  const r = leaderInterventionFeatures(o); r.zero = true;
  const p = selectedPrediction(r), a = displayedActiveFeatures(o), sp = quantizedSupportSP(a);
  const previous = selectedPrediction(r, {});
  return { schemaVersion: 1, sampleId: 'AZ', leaderId: o.leaderId, memberIds: o.memberIds, profiles: o.profiles,
    boardOverrides: o.boardOverrides, leaderSupportOverride: 13.3, leaderJudgmentRequested: true,
    procedure: 'Keep AX composition/levels and pre-song view. Disable only all remaining Noel activation-rate nodes11.1/3.7/3.0; Noel frequency remainsOFF. Kanade timing remainsOFF. Ririka support6.2/4/3.1 and judgment node remainON. Do not reset whole boards; report connected extra effects if needed.',
    prediction: { active: a.A, special: sp.display, passive: p.passive, board: p.board },
    alternatives: [{ name: 'No intermediate probability/value quantization; same endpoint/allocation rule', passive: previous.passive, board: previous.board },
      { name: 'Descriptive AX-only constant +0.1 extrapolation, not adopted', passive: 0, board: Number((p.board + .1).toFixed(9)) }],
    diagnostics: { rawActive: p.sums.A, rawBoardApplied: p.sums.BP, roundedIncrement: p.roundedIncrement },
    observationsReceived: [], rationale: 'AX has no score-support passive. Removing Noel timing leaves the requested numeric leader support as the only modeled board contribution. A match tests this baseline; a mismatch shows the residual persists without member timing. Neither outcome alone identifies a unique internal formula or proves judgment nodes contribute zero.',
    productionFormulaChanged: false,
    provenance: { source, sourceSHA256: hash(source), createdAfterAXObservation: true, createdBeforeAZMeasurement: true,
      sourceHashes: Object.fromEntries(['analysis/unit-score/plan-ax-noel-off-az-20260909.mjs', 'analysis/unit-score/probe-expanded-at-20260909.mjs',
        'analysis/unit-score/expanded-kernel-at-20260909.mjs'].map(p => [p, hash(p)])) } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planAZ(), null, 2));
