import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { collectCatalog } from './compare-am-an-20260909.mjs';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { leaderInterventionFeatures } from './plan-leader-at-20260909.mjs';
import { sourceLock } from './io.mjs';

const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
const excluded = ['G', 'I', 'J', 'M', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'AC', 'AD', 'AE'];
const modes = ['ceil', 'floor', 'round'];
const round = (v, mode, precision) => Math[mode](v * 10 ** precision + (mode === 'ceil' ? -1e-8 : mode === 'floor' ? 1e-8 : 0)) / 10 ** precision;

export function probeRoundingATRecheck() {
  const catalog = 'analysis/unit-score/observation-catalog-AT-20260909.json';
  const confirmationPath = 'analysis/unit-score/observations/AR-reconfirmation-20260909.json';
  const entries = collectCatalog(catalog), rows = [], observationHashes = {};
  for (const entry of entries) {
    assert.equal(hash(entry.sourcePath), entry.sourceSHA256);
    observationHashes[entry.sourcePath] = entry.sourceSHA256;
    if (excluded.includes(entry.sampleId)) continue;
    const source = read(entry.sourcePath);
    const o = entry.initialFixtureIndex == null ? source : source.observations[entry.initialFixtureIndex];
    const r = o.leaderSupportOverride == null ? allocationFeatures(o) : leaderInterventionFeatures(o);
    assert.ok(r.features.some(m => m.s > 0));
    assert.ok(r.observedPassive != null && r.observedBoard != null);
    rows.push(r);
  }
  const configs = [];
  for (const countMode of ['floor', 'fractional']) {
    configs.push({ countMode, stage: 'raw' });
    for (const precision of [0, 1, 2, 3, 4]) for (const mode of modes) for (const stage of ['S', 'A', 'BP', 'both']) {
      configs.push({ countMode, precision, mode, stage });
    }
  }
  const variants = [];
  const evaluate = config => rows.map(r => {
    const { stage, mode, precision, countMode, pMode, bMode } = config;
    const raw = stage === 'raw' ? r.raw : stage === 'S' ? round(r.raw, mode, precision)
      : stage === 'both' ? round(r.BPraw, mode, precision) - round(r.Araw, mode, precision)
      : stage === 'A' ? r.BPraw - round(r.Araw, mode, precision) : round(r.BPraw, mode, precision) - r.Araw;
    const a = proportionalAllocation({ ...r, raw }, { countMode });
    const passive = round(a.rawPassive, pMode, 1), board = round(a.rawBoard, bMode, 1);
    return { id: r.id, passive, board, observedPassive: r.observedPassive, observedBoard: r.observedBoard,
      matches: passive === r.observedPassive && board === r.observedBoard };
  });
  for (const base of configs) for (const pMode of modes) for (const bMode of modes) {
    const config = { ...base, pMode, bMode }, values = evaluate(config);
    variants.push({ config, pairs: values.filter(v => v.matches).length,
      failures: values.filter(v => !v.matches).map(v => v.id) });
  }
  const best = Math.max(...variants.map(v => v.pairs));
  const bestVariants = variants.filter(v => v.pairs === best).map(v => ({ ...v, values: evaluate(v.config) }));
  const confirmation = read(confirmationPath), ar = rows.find(r => r.id === 'AR');
  assert.equal(hash(confirmation.originalObservation), confirmation.originalObservationSHA256);
  assert.equal(confirmation.confirmedScoreBonusDetail.passive, ar.observedPassive);
  assert.equal(confirmation.confirmedScoreBonusDetail.board, ar.observedBoard);
  return { schemaVersion: 1, observedThrough: 'AT', catalog, catalogObservations: entries.length,
    eligiblePositivePassiveObservations: rows.length, excluded,
    reconfirmation: { path: confirmationPath, countsAsNewSample: false, passive: ar.observedPassive, board: ar.observedBoard },
    search: { attempts: variants.length, bestPairs: best, perfect: variants.filter(v => v.pairs === rows.length),
      grid: { counts: ['floor', 'fractional'], intermediatePrecisions: [0, 1, 2, 3, 4], intermediateModes: modes,
        intermediateStages: ['raw', 'S', 'A', 'BP', 'both'], finalPassiveModes: modes, finalBoardModes: modes,
        note: 'Raw has no intermediate mode or precision. (2 + 2*5*3*4)*3*3 = 1098 configurations.' },
      bestVariants, allVariants: variants },
    featureRows: rows,
    evidence: { allMatchesRetrospective: true, productionFormulaChanged: false,
      limitations: ['AR score rows were reconfirmed; no new measurement procedure or independent node audit was supplied.',
        'The two best configurations still fail AR. This finite search does not exclude all possible rounding algorithms.',
        'The same observations selected and evaluated these variants; 28/29 is not an independent success rate.',
        'Excluded zero-passive cases, score-support costumes and unknown leader boards remain outside this audit.',
        'Final unit score and actual-song scores remain unmeasured.'] },
    provenance: { catalogSHA256: hash(catalog), confirmationSHA256: hash(confirmationPath), observationHashes,
      sourceHashes: sourceLock(), analysisSourceSHA256: hash('analysis/unit-score/probe-rounding-at-recheck-20260909.mjs'),
      featureSourceSHA256: hash('analysis/unit-score/probe-proportional-allocation-20260909.mjs'),
      leaderOverrideSourceSHA256: hash('analysis/unit-score/plan-leader-at-20260909.mjs') } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(probeRoundingATRecheck(), null, 2));
