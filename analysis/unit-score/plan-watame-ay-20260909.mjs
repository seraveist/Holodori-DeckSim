import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { allocationFeatures } from './probe-proportional-allocation-20260909.mjs';
import { selectedPrediction } from './probe-expanded-at-20260909.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function planAY() {
  const baseline = 'analysis/unit-score/experiments/baseline-challenges-AV-AX-20260909.json';
  const aw = read(baseline).plans.find(p => p.sampleId === 'AW');
  const o = { sampleId: 'AY', leaderId: aw.leaderId, memberIds: aw.memberIds, profiles: aw.profiles,
    boardOverrides: { ...aw.boardOverrides, 'chr-00026': { rate: 0, cooldown: 0 } } };
  const f = allocationFeatures(o), p = selectedPrediction(f);
  return { schemaVersion: 1, ...o, status: 'Planned; no AY measurement received', observationsReceived: [],
    origin: 'User confirmed AW and proposed turning off only Watame boards next.',
    userRequest: '일단 AW는 모두 일치하는걸 확인했어. 다음으로 와타메의 보드만 끄고 다시 알려줄께.',
    scopeInterpretation: 'Only the previously specified Watame activation-rate and frequency nodes are meant here. Whether the user instead resets the full tree or changes extra effects must be recorded with the result.',
    intervention: 'Keep AW cards/profiles and all other character boards unchanged. Turn OFF Watame rate11.1%,3.7%,3%,3%,3.7% (total24.5%) and frequency4%. Do not reset unrelated board nodes.',
    leaderSupportPct: 13.3, leaderSupportNodesPct: [6.2, 4, 3.1], leaderJudgmentEnabled: true,
    measurementView: 'Formation detail before song selection',
    prediction: { active: p.active, special: aw.prediction.special, passive: p.passive, board: p.board },
    diagnostic: { rawBP: p.sums.BP, rawA: p.sums.A, roundedIncrement: p.roundedIncrement,
      AWReference: { active: 74, special: 42.9, passive: 4.7, board: 11.3 },
      expectedDisplayedJointChange: '4.7+11.3=16.0 to7.0+12.0=19.0. The fixed-window model predicts an increase when these timing nodes turn off; this is a falsifiable forecast, not a claimed improvement in played-song score.' },
    requestedMeasurements: ['passive score', 'board score', 'active score', 'SP score', 'any additional board effects disabled'],
    unpredicted: ['board/memory/enhancement power', 'overall totals', 'final unit score', 'played-song score'],
    provenance: { baseline, baselineSHA256: hash(baseline),
      analysisSourceSHA256: hash('analysis/unit-score/plan-watame-ay-20260909.mjs'),
      expandedSourceSHA256: hash('analysis/unit-score/probe-expanded-at-20260909.mjs'),
      kernelSourceSHA256: hash('analysis/unit-score/expanded-kernel-at-20260909.mjs') }, productionFormulaChanged: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planAY(), null, 2));
