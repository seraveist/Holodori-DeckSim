import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { collectCatalog } from './compare-am-an-20260909.mjs';
import { interventionEnvironment } from './board-intervention-20260909.mjs';
import { condition, integrate, round1 } from './dummy-model-lab.mjs';
import { sourceLock } from './io.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');

export function allocationFeatures(o, overrides = o.boardOverrides ?? {}) {
  const e = interventionEnvironment(o, overrides);
  const Araw = integrate(e.team), Braw = integrate(e.adjusted, { outfit: e.leaderBoardSupport });
  const BPraw = integrate(e.adjusted, { outfit: e.leaderBoardSupport, passive: true });
  return { id: o.sampleId, raw: BPraw - Araw, Araw, Braw, BPraw,
    observedPassive: o.game?.scoreBonusDetail.passive ?? null, observedBoard: o.game?.scoreBonusDetail.board ?? null,
    features: e.team.members.map((m, i) => ({ id: m.id, p: m.active.probability, d: m.active.duration, I: m.active.interval,
      v: condition(m.active.condition, e.team) ? m.active.conditionalScoreUp : m.active.baseScoreUp,
      s: e.team.support[i], r: e.inputs[i].board.rate, f: e.inputs[i].board.cooldown, L: e.leaderBoardSupport,
      count: Math.floor(200 / m.active.interval) })) };
}
const weights = { equal: m => 1, probability: m => m.p, duration: m => m.d, value: m => m.v,
  frequency: m => 1 / m.I, uptime: m => m.d / m.I, probabilityDuration: m => m.p * m.d,
  expectedUptime: m => m.p * m.d / m.I, expectedEffect: m => m.p * m.d * m.v / m.I,
  effectTime: m => m.d * m.v, count: m => m.count, expectedCount: m => m.p * m.count,
  eventTime: m => m.p * m.d * m.count, expectedWindowEffect: m => m.p * m.v * m.d * m.count };
const boardForms = { additive: m => m.r + m.f + m.L,
  multiplicative: m => ((1 + m.r / 100) * (1 + m.f / 100) * (1 + m.L / 100) - 1) * 100,
  timingProduct: m => ((1 + m.r / 100) * (1 + m.f / 100) - 1) * 100 + m.L };
const passiveForms = { plain: m => m.s, afterTiming: m => m.s * (1 + m.r / 100) * (1 + m.f / 100),
  afterLeader: m => m.s * (1 + m.L / 100), afterAll: m => m.s * (1 + m.r / 100) * (1 + m.f / 100) * (1 + m.L / 100) };

export function proportionalAllocation(row, config = {}) {
  const { weight = 'expectedWindowEffect', board = 'multiplicative', passive = 'plain', duration = 200, countMode = 'floor' } = config;
  const w = duration === 200 && countMode === 'floor' ? weights[weight] : m => m.p * m.v * m.d * (countMode === 'fractional' ? duration / m.I : Math[countMode](duration / m.I));
  let passiveWeight = 0, boardWeight = 0;
  for (const m of row.features) {
    passiveWeight += w(m) * passiveForms[passive](m);
    boardWeight += w(m) * boardForms[board](m);
  }
  assert.ok(passiveWeight + boardWeight > 0);
  const rawPassive = row.raw * passiveWeight / (passiveWeight + boardWeight), rawBoard = row.raw - rawPassive;
  return { id: row.id, passiveWeight, boardWeight, rawPassive, rawBoard, passive: round1(rawPassive), board: round1(rawBoard),
    observedPassive: row.observedPassive, observedBoard: row.observedBoard,
    passiveMatches: row.observedPassive == null ? null : round1(rawPassive) === row.observedPassive,
    boardMatches: row.observedBoard == null ? null : round1(rawBoard) === row.observedBoard };
}

export function probeProportionalAllocation() {
  const catalog = 'analysis/unit-score/observation-catalog-AO-20260909.json', entries = collectCatalog(catalog);
  const rows = [], excluded = [], observationHashes = {};
  for (const entry of entries) {
    assert.equal(hash(entry.sourcePath), entry.sourceSHA256);
    observationHashes[entry.sourcePath] = entry.sourceSHA256;
    const source = read(entry.sourcePath), o = entry.initialFixtureIndex == null ? source : source.observations[entry.initialFixtureIndex];
    // Exclusion is explicit; malformed observations must still fail during preparation.
    if (['G', 'I', 'J', 'M', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'AC', 'AD', 'AE'].includes(o.sampleId)) {
      excluded.push({ id: o.sampleId, reason: ['I', 'J', 'M'].includes(o.sampleId) ? 'Score-support costume needs a separate model.' : o.sampleId === 'U' ? 'Leader board inputs outside confirmed scope.' : 'No score-support passive; handled by the existing zero-passive research, including unresolved G.' });
      continue;
    }
    const f = allocationFeatures(o);
    assert.ok(f.features.some(m => m.s > 0));
    rows.push(f);
  }
  const summarize = (config, values) => ({ config, matches: values.filter(v => v.passiveMatches && v.boardMatches).length,
    passiveMatches: values.filter(v => v.passiveMatches).length, boardMatches: values.filter(v => v.boardMatches).length,
    failures: values.filter(v => !v.passiveMatches || !v.boardMatches).map(v => v.id) });
  const variants = [];
  for (const weight of Object.keys(weights)) for (const board of Object.keys(boardForms)) for (const passive of Object.keys(passiveForms)) {
    const config = { weight, board, passive };
    variants.push(summarize(config, rows.map(r => proportionalAllocation(r, config))));
  }
  variants.sort((a, b) => b.matches - a.matches || b.passiveMatches + b.boardMatches - a.passiveMatches - a.boardMatches);
  const selected = { weight: 'expectedWindowEffect', board: 'multiplicative', passive: 'plain', duration: 200, countMode: 'floor' };
  const values = rows.map(r => proportionalAllocation(r, selected));
  const timingSearch = [];
  for (let duration = 30; duration <= 600; duration++) for (const countMode of ['floor', 'ceil', 'fractional']) {
    const config = { ...selected, duration, countMode };
    timingSearch.push(summarize(config, rows.map(r => proportionalAllocation(r, config))));
  }
  timingSearch.sort((a, b) => b.matches - a.matches || b.passiveMatches + b.boardMatches - a.passiveMatches - a.boardMatches);
  return { schemaVersion: 1, observedThrough: 'AO', catalog, observations: entries.length, eligibleObservations: rows.length,
    scope: 'Exploratory proportional allocation for positive score-support passives and previously documented numeric boards. Production untouched.',
    formula: { weight: 'w_i = p_i * effectiveValue_i * duration_i * floor(200 / interval_i), using base Active inputs.',
      passiveWeight: 'PW = sum(w_i * passiveSupportPct_i)',
      boardWeight: 'BW = sum(w_i * 100 * [(1+memberRatePct_i/100)*(1+memberFrequencyPct_i/100)*(1+leaderSupportPct/100)-1])',
      joint: 'S = existing normalized 200-second BPraw - Araw, using board-adjusted timing/probability and additive support.',
      allocation: 'Passive = ceil0.1(S * PW/(PW+BW)); Board = ceil0.1(S * BW/(PW+BW)).',
      interpretation: 'Divide the modeled total increment by nominal standalone buff weights. This is an attribution hypothesis, not evidence the game literally implements these intermediate weights.' },
    selected, summary: summarize(selected, values), values, featureRows: rows, excluded,
    search: { coefficientFamilies: variants.length, weightNames: Object.keys(weights), boardForms: Object.keys(boardForms), passiveForms: Object.keys(passiveForms),
      topVariants: variants.slice(0, 10), perfectVariants: variants.filter(v => v.matches === rows.length),
      freeTiming: { from: 30, to: 600, modes: ['floor', 'ceil', 'fractional'], attempts: timingSearch.length,
        topCandidates: timingSearch.slice(0, 10), perfectCandidates: timingSearch.filter(v => v.matches === rows.length),
        decision: 'Do not adopt a fitted duration such as405. Even the best searched duration fails an observation; arbitrary timing search is diagnostic, not independent validation.' } },
    evidence: { allMatchesRetrospective: true, independentPredictions: 0,
      AO: 'AO timing-equivalence was frozen earlier, but the proportional formula was developed after AO arrived; it is not an independent success for this formula.',
      limitations: ['Four remaining category discrepancies are failures, not accepted rounding tolerance.',
        'No zero-passive, score-support-costume, unknown-board-leader or played-song generalization is established.',
        'No per-card fitted constants were introduced. Existing Active duration200 is reused as a hypothesis; its internal game meaning is unproved.'] },
    provenance: { catalogSHA256: hash(catalog), observationHashes, sourceHashes: sourceLock(),
      analysisSourceSHA256: hash('analysis/unit-score/probe-proportional-allocation-20260909.mjs'),
      interventionSourceSHA256: hash('analysis/unit-score/board-intervention-20260909.mjs') } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(probeProportionalAllocation(), null, 2));
