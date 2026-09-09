import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { collectCatalog } from './compare-am-an-20260909.mjs';
import { allocationFeatures, proportionalAllocation } from './probe-proportional-allocation-20260909.mjs';
import { round1 } from './dummy-model-lab.mjs';
import { sourceLock } from './io.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
const excludedIds = ['G', 'I', 'J', 'M', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'AC', 'AD', 'AE'];
export function roundedAllocation(row) {
  const roundedIncrement = Number((round1(row.BPraw) - round1(row.Araw)).toFixed(9));
  return { ...proportionalAllocation({ ...row, raw: roundedIncrement }, { countMode: 'fractional' }), roundedIncrement };
}
export function probeRoundedAllocation() {
  const catalog = 'analysis/unit-score/observation-catalog-AQ-20260909.json', entries = collectCatalog(catalog), rows = [], observationHashes = {};
  for (const entry of entries) {
    assert.equal(hash(entry.sourcePath), entry.sourceSHA256);
    observationHashes[entry.sourcePath] = entry.sourceSHA256;
    if (excludedIds.includes(entry.sampleId)) continue;
    const source = read(entry.sourcePath), o = entry.initialFixtureIndex == null ? source : source.observations[entry.initialFixtureIndex];
    const f = allocationFeatures(o);
    assert.ok(f.features.some(m => m.s > 0));
    rows.push(f);
  }
  const summarize = values => ({ pairs: values.filter(v => v.passiveMatches && v.boardMatches).length,
    passive: values.filter(v => v.passiveMatches).length, board: values.filter(v => v.boardMatches).length,
    failures: values.filter(v => !v.passiveMatches || !v.boardMatches).map(v => v.id) });
  const round = (v, mode, precision) => Math[mode](v * 10 ** precision + (mode === 'ceil' ? -1e-8 : mode === 'floor' ? 1e-8 : 0)) / 10 ** precision;
  const variants = [];
  for (const countMode of ['floor', 'fractional']) for (const precision of [0, 1, 2, 3, 4]) for (const mode of ['ceil', 'floor', 'round']) for (const stage of ['S', 'A', 'BP', 'both']) {
    const values = rows.map(r => {
      const raw = stage === 'S' ? round(r.raw, mode, precision) : stage === 'both' ? round(r.BPraw, mode, precision) - round(r.Araw, mode, precision)
        : stage === 'A' ? r.BPraw - round(r.Araw, mode, precision) : round(r.BPraw, mode, precision) - r.Araw;
      return proportionalAllocation({ ...r, raw }, { countMode });
    });
    variants.push({ countMode, precision, mode, stage, ...summarize(values) });
  }
  variants.sort((a, b) => b.pairs - a.pairs);
  const values = rows.map(roundedAllocation);
  return { schemaVersion: 1, observedThrough: 'AQ', catalog, eligibleObservations: rows.length,
    formula: { activeKernel: 'Retain existing200-second normalized Active kernel and board/passive inputs.',
      increment: 'Q = ceil0.1(BPraw) - ceil0.1(Araw)',
      weight: 'w_i = p_i * effectiveValue_i * duration_i / interval_i; common time multiplier cancels in the ratio.',
      passiveWeight: 'PW = sum(w_i * passiveSupportPct_i)',
      boardWeight: 'BW = sum(w_i *100*[(1+rate_i/100)(1+frequency_i/100)(1+leaderSupportPct/100)-1])',
      display: 'P=ceil0.1(Q*PW/(PW+BW)); B=ceil0.1(Q*BW/(PW+BW)).',
      interpretation: 'Round total and base Active before subtraction, then allocate their difference by continuous nominal buff weights. Not a proved internal implementation.' },
    summary: summarize(values), values, featureRows: rows,
    ablations: { originalFiniteRawIncrement: summarize(rows.map(r => proportionalAllocation(r))),
      fractionalRawIncrement: summarize(rows.map(r => proportionalAllocation(r, { countMode: 'fractional' }))),
      finiteRoundedIncrement: summarize(rows.map(r => proportionalAllocation({ ...r, raw: Number((round1(r.BPraw) - round1(r.Araw)).toFixed(9)) }))) },
    search: { attempts: variants.length, grid: { counts: ['floor', 'fractional'], precisions: [0, 1, 2, 3, 4], modes: ['ceil', 'floor', 'round'], stages: ['S', 'A', 'BP', 'both'] },
      perfect: variants.filter(v => v.pairs === rows.length), allVariants: variants,
      ambiguity: 'Rounding both terms upward or both downward at0.1 is indistinguishable in this sample. Select upward consistently with displayed Active; do not claim the data uniquely distinguish it.' },
    evidence: { allRetrospective: true, prospectiveObservations: 0,
      AQ: 'The AQ result prompted this120-variant precision/count search. AQ is not prospective validation for the new rounded formula.',
      exclusions: excludedIds, limitations: ['Positive passive and documented numeric boards only; G zero-passive discrepancy remains.',
        'Score-support costumes I/J/M, unknown board leader U, judgment nodes, final unit score and actual-song scores are outside this result.',
        '26 observations include repeated sets and controls; they are not26 independent card combinations.',
        'Old failed predictions are preserved; no per-card fitted constants or free duration were added.'], productionFormulaChanged: false },
    provenance: { catalogSHA256: hash(catalog), observationHashes, sourceHashes: sourceLock(),
      analysisSourceSHA256: hash('analysis/unit-score/probe-rounded-allocation-aq-20260909.mjs'),
      featureSourceSHA256: hash('analysis/unit-score/probe-proportional-allocation-20260909.mjs'),
      interventionSourceSHA256: hash('analysis/unit-score/board-intervention-20260909.mjs') } };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(probeRoundedAllocation(), null, 2));
