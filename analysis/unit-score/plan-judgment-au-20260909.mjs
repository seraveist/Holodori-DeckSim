import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
export function planAU() {
  const baselinePath = 'analysis/unit-score/observations/AS-20260909.json', as = read(baselinePath);
  const predecessorPath = 'analysis/unit-score/observations/AT-20260909.json', at = read(predecessorPath);
  const boardRecord = 'analysis/unit-score/board-observations/ririka-X-20260909.json';
  const record = read(boardRecord);
  assert.equal(record.judgement.intervalSeconds, 20); assert.equal(record.judgement.durationSeconds, 7);
  assert.equal(as.game.scoreBonusDetail.passive, 3); assert.equal(as.game.scoreBonusDetail.board, 10.1);
  assert.equal(at.leaderSupportOverride, 10.2);
  return { schemaVersion: 1, sampleId: 'AU', leaderId: as.leaderId, memberIds: as.memberIds, profiles: as.profiles,
    boardOverrides: as.boardOverrides, leaderSupportOverride: 13.3, leaderJudgmentEnabled: false,
    status: 'Planned; no AU measurement received', observationsReceived: [],
    intervention: 'Restore Ririka score-support3.1% from AT, returning6.2%+4%+3.1%=13.3% as in AS. Disable only Ririka judgment conversion: every20s, low chance,7s GOOD-or-better to PERFECT. Keep all member timing boards OFF and all other effects unchanged. If the judgment node cannot be disabled independently, report dependencies first.',
    baselineValues: read('analysis/unit-score/experiments/baseline-no-timing-AS-20260909.json').baselineValues,
    hypotheses: { judgmentExplainsASExtraBoard: { passive: 3, board: 10,
      status: 'Conditional prediction: if the omitted judgment effect explains AS surplus over exact displayed-input direct marginal, removing it returns board10.0.' },
      unchangedAfterJudgmentOff: { passive: 3, board: 10.1,
        status: 'No displayed change from AS; rejects the proposed visible judgment explanation in this control, but does not uniquely prove hidden precision or zero raw effect.' } },
    purpose: 'Compare AU with AS at identical numeric support and member timing inputs, isolating the previously unmodeled judgment node. The AT-to-AU two-node change restores the AS baseline before the single-effect comparison.',
    requestedMeasurements: 'Passive and board rows plus Active/SP when visible. Confirm any dependency or extra effect that must change.',
    provenance: { baselinePath, baselineSHA256: hash(baselinePath), predecessorPath, predecessorSHA256: hash(predecessorPath),
      boardRecord, boardRecordSHA256: hash(boardRecord), reportPath: 'analysis/unit-score/reports/AT-comparison-20260909.json',
      reportSHA256: hash('analysis/unit-score/reports/AT-comparison-20260909.json'),
      analysisSourceSHA256: hash('analysis/unit-score/plan-judgment-au-20260909.mjs'), productionFormulaChanged: false } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planAU(), null, 2));
