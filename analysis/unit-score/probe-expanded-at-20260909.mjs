import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { collectCatalog } from './compare-am-an-20260909.mjs';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { leaderInterventionFeatures } from './plan-leader-at-20260909.mjs';
import { model, ratio, increment, modes, q } from './expanded-kernel-at-20260909.mjs';
import { sourceLock } from './io.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
const catalog = 'analysis/unit-score/observation-catalog-AT-20260909.json';
export const selectedEngine = { sites: [{ stage: 'value', digits: 1, mode: 'ceil' }, { stage: 'probabilityPercent', digits: 1, mode: 'ceil' }] };

export function expandedRows() {
  const rows = [], excluded = [], observationHashes = {};
  for (const e of collectCatalog(catalog)) {
    assert.equal(hash(e.sourcePath), e.sourceSHA256);
    observationHashes[e.sourcePath] = e.sourceSHA256;
    const source = read(e.sourcePath), o = e.initialFixtureIndex == null ? source : source.observations[e.initialFixtureIndex];
    if (['I', 'J', 'M', 'U'].includes(e.sampleId)) {
      excluded.push({ id: e.sampleId, reason: e.sampleId === 'U' ? 'Leader board inputs outside confirmed scope' : 'Score-support costume not modeled' });
      continue;
    }
    const r = o.leaderSupportOverride == null ? allocationFeatures(o) : leaderInterventionFeatures(o);
    rows.push({ ...r, zero: !r.features.some(m => m.s > 0),
      observedActive: o.game.scoreBonusDetail.active, observedSpecial: o.game.scoreBonusDetail.special,
      rawPassiveWasAbsent: o.scoreRowPresence?.passive === false });
  }
  return { rows, excluded, observationHashes };
}

export function selectedPrediction(row, engine = selectedEngine) {
  const z = model(row, engine).sums, Q = Number((q(z.BP) - q(z.A)).toFixed(9));
  const a = proportionalAllocation({ ...row, raw: Q }, { countMode: 'fractional' });
  return { id: row.id, passive: a.passive + 0, board: a.board + 0, active: q(z.A),
    observedPassive: row.observedPassive, observedBoard: row.observedBoard, observedActive: row.observedActive ?? null,
    passiveMatches: row.zero ? a.passive === 0 : a.passive === row.observedPassive,
    boardMatches: a.board === row.observedBoard, activeMatches: row.observedActive == null ? null : q(z.A) === row.observedActive,
    zeroPassive: row.zero, rawPassiveWasAbsent: row.rawPassiveWasAbsent ?? false, sums: z, roundedIncrement: Q };
}

export function probeExpandedAT() {
  const all = expandedRows(), rows = all.rows.filter(r => !r.zero);
  const pools = ['raw', 'ends-ceil', 'ends-floor', 'ends-round', 'delta-ceil', 'delta-floor', 'delta-round'];
  const stages = ['probabilityPercent', 'interval', 'value', 'denominator', 'numeratorMember', 'normalizedMember', 'tick', 'integratedMember'];
  const configs = [{}, { stage: 'float32Inputs' }, { stacking: 'product' }];
  for (const stage of stages) for (const digits of [0, 1, 2, 3, 4]) for (const mode of modes) configs.push({ stage, digits, mode });
  let attempts = 0;
  const digest = crypto.createHash('sha256'), histogram = {}, nearBest = [], summaries = [];
  const consider = (config, values) => {
    attempts++;
    const pairs = values.filter((v, i) => v.p === rows[i].observedPassive && v.b === rows[i].observedBoard).length;
    const failures = values.filter((v, i) => v.p !== rows[i].observedPassive || v.b !== rows[i].observedBoard);
    histogram[pairs] = (histogram[pairs] ?? 0) + 1;
    digest.update(JSON.stringify({ config, values }) + '\n');
    if (pairs >= 28) nearBest.push({ config, pairs, failures, ...(pairs === 29 ? { values } : {}) });
    return pairs;
  };
  for (const engine of configs) {
    const models = rows.map(r => model(r, engine));
    if (!Object.keys(engine).length) models.forEach((m, i) => {
      assert.ok(Math.abs(m.sums.A - rows[i].Araw) < 1e-8);
      assert.ok(Math.abs(m.sums.B - rows[i].Braw) < 1e-8);
      assert.ok(Math.abs(m.sums.BP - rows[i].BPraw) < 1e-8);
    });
    const baseMatches = models.filter((m, i) => q(m.sums.A) === q(rows[i].Araw)).length;
    if (baseMatches !== rows.length) { summaries.push({ engine, baseMatches, excludedByActiveGate: true }); continue; }
    let best = 0;
    for (const pool of pools) for (const countMode of ['fractional', 'floor', 'sampled']) for (const pMode of modes) for (const bMode of modes) {
      const values = rows.map((r, i) => {
        const z = models[i].sums, Q = increment(z.A, z.BP, pool), f = ratio(r, countMode);
        return { id: r.id, p: q(Q * f, pMode), b: q(Q * (1 - f), bMode), op: r.observedPassive, ob: r.observedBoard };
      });
      best = Math.max(best, consider({ engine, pool, countMode, pMode, bMode }, values));
    }
    for (const attribution of ['boardFirst', 'passiveFirst', 'shapley']) for (const pool of ['raw', 'ends-ceil', 'ends-floor', 'ends-round']) for (const pMode of modes) for (const bMode of modes) {
      const values = rows.map((r, i) => {
        let { A, P, B, BP } = models[i].sums;
        if (pool !== 'raw') { const mode = pool.slice(5); [A, P, B, BP] = [A, P, B, BP].map(v => q(v, mode)); }
        const p = attribution === 'boardFirst' ? BP - B : attribution === 'passiveFirst' ? P - A : ((BP - B) + (P - A)) / 2;
        return { id: r.id, p: q(p, pMode), b: q(BP - A - p, bMode), op: r.observedPassive, ob: r.observedBoard };
      });
      best = Math.max(best, consider({ engine, attribution, pool, pMode, bMode }, values));
    }
    summaries.push({ engine, baseMatches, best });
  }
  const base = rows.map(r => model(r));
  for (const countMode of ['fractional', 'floor', 'sampled', 'normalizedBase', 'normalizedBoard']) for (const boardMode of ['multiplicative', 'additive', 'timingProduct']) for (const passiveMode of ['plain', 'afterTiming', 'afterLeader', 'afterAll']) for (const pool of pools) for (const pMode of modes) for (const bMode of modes) {
    const values = rows.map((r, i) => {
      const z = base[i].sums, Q = increment(z.A, z.BP, pool);
      const times = countMode === 'normalizedBase' ? base[i].per.A : countMode === 'normalizedBoard' ? base[i].per.B : null;
      const f = ratio(r, countMode, boardMode, passiveMode, times);
      return { id: r.id, p: q(Q * f, pMode), b: q(Q * (1 - f), bMode), op: r.observedPassive, ob: r.observedBoard };
    });
    consider({ family: 'weights', countMode, boardMode, passiveMode, pool, pMode, bMode }, values);
  }
  // Adaptive second stage: combine each winning single-site mechanism with one other precision site.
  // The full known zero-passive sample is now used for selection, never called a holdout.
  const anchors = [{ stage: 'value', digits: 1, mode: 'ceil' }, { stage: 'denominator', digits: 3, mode: 'floor' }];
  const pairSearch = [];
  for (const primary of anchors) for (const stage of stages.filter(s => s !== 'integratedMember')) for (const digits of [0, 1, 2, 3, 4]) for (const mode of modes) {
    if (stage === primary.stage) continue;
    const engine = { sites: [primary, { stage, digits, mode }] };
    const values = all.rows.map(r => selectedPrediction(r, engine));
    const active = values.filter((v, i) => v.active === q(all.rows[i].Araw)).length;
    const positive = values.filter(v => !v.zeroPassive && v.passiveMatches && v.boardMatches).length;
    const zero = values.filter(v => v.zeroPassive && v.passiveMatches && v.boardMatches).length;
    pairSearch.push({ engine, active, positive, zero, failures: values.filter(v => !v.passiveMatches || !v.boardMatches).map(v => v.id) });
  }
  const selected = all.rows.map(r => selectedPrediction(r));
  const selectedFeatures = all.rows.filter(r => ['AR', 'G', 'AS', 'AT'].includes(r.id));
  const ablations = [{ name: 'old endpoints only', engine: {} }, { name: 'value only', engine: anchors[0] },
    { name: 'probability only', engine: { stage: 'probabilityPercent', digits: 1, mode: 'ceil' } },
    { name: 'denominator only', engine: anchors[1] }].map(c => {
      const values = all.rows.map(r => selectedPrediction(r, c.engine));
      return { ...c, pairs: values.filter(v => v.passiveMatches && v.boardMatches).length,
        failures: values.filter(v => !v.passiveMatches || !v.boardMatches).map(v => ({ id: v.id, passive: v.passive, board: v.board, observedPassive: v.observedPassive, observedBoard: v.observedBoard })) };
    });
  return { schemaVersion: 1, observedThrough: 'AT', reconfirmed: 'AR', catalog,
    observations: 44, numericBoardObservations: all.rows.length, positivePassive: rows.length, zeroPassive: all.rows.length - rows.length,
    exclusions: all.excluded,
    firstSearch: { attempts, engineConfigurations: configs.length, admittedEngines: summaries.filter(s => !s.excludedByActiveGate).length,
      histogram, completeOrderedResultSHA256: digest.digest('hex'),
      grid: { stages, precisions: [0, 1, 2, 3, 4], modes, pools, countModes: ['fractional', 'floor', 'sampled'],
        attribution: ['boardFirst', 'passiveFirst', 'shapley'], weightModes: ['fractional', 'floor', 'sampled', 'normalizedBase', 'normalizedBoard'],
        stacking: ['additive', 'product'], float32Scope: 'Inputs only; not a complete float32 arithmetic implementation' },
      engineSummaries: summaries, perfect: nearBest.filter(v => v.pairs === rows.length), nearBest },
    secondSearch: { adaptive: true, anchors, attempts: pairSearch.length, allConfigurations: pairSearch,
      perfect: pairSearch.filter(v => v.active === 40 && v.positive === 29 && v.zero === 11) },
    selected: { engine: selectedEngine, pool: 'ends-ceil', countMode: 'fractional', finalRounding: 'ceil0.1',
      positiveMatches: selected.filter(v => !v.zeroPassive && v.passiveMatches && v.boardMatches).length,
      zeroMatches: selected.filter(v => v.zeroPassive && v.passiveMatches && v.boardMatches).length,
      activeObserved: selected.filter(v => v.observedActive != null).length,
      activeMatches: selected.filter(v => v.activeMatches === true).length,
      values: selected, diagnosticFeatures: selectedFeatures, ablations },
    evidence: { allMatchesRetrospective: true, productionFormulaChanged: false, prospectiveMeasurements: 0,
      limitations: ['Both searches used known observations, including G and reconfirmed AR. This is not a holdout success or unique proof of an internal formula.',
        'Configuration counts include equivalent formulas; search is bounded to the declared stages and is not exhaustive.',
        'No per-card/sample constants, fitted duration, invented board precision or judgment probability were added.',
        'Absent passive rows stay absent in source JSON; zero is used only for this model comparison.',
        'Score-support costumes I/J/M and unconfirmed leader-board U remain excluded. Final unit score and actual-song scores are unmeasured.',
        'Earlier failed frozen predictions remain failed; new fits do not rewrite their history.'] },
    provenance: { catalogSHA256: hash(catalog), observationHashes: all.observationHashes, sourceHashes: sourceLock(),
      analysisSourceSHA256: hash('analysis/unit-score/probe-expanded-at-20260909.mjs'),
      kernelSourceSHA256: hash('analysis/unit-score/expanded-kernel-at-20260909.mjs'),
      featureSourceSHA256: hash('analysis/unit-score/probe-proportional-allocation-20260909.mjs'),
      leaderOverrideSourceSHA256: hash('analysis/unit-score/plan-leader-at-20260909.mjs') } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(probeExpandedAT(), null, 2));
