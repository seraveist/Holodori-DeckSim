import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { collectCatalog } from './compare-am-an-20260909.mjs';
import { allocationFeatures } from './probe-proportional-allocation-20260909.mjs';
import { selectedPrediction, selectedEngine } from './probe-expanded-at-20260909.mjs';
import { displayedActiveFeatures } from './probe-sp-displayed-active-20260909.mjs';
import { quantizedSupportSP } from './compare-sp-v-rounding-20260909.mjs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(new URL(p, root))).digest('hex');
const ids = {
  leader: 'card-06003-3-nrml-0059-00', suisei: 'card-00018-5-uniq-0068-00', noel: 'card-00022-5-uniq-0063-00',
  kanade: 'card-06002-5-uniq-0058-00', kanadeSwim: 'card-06002-5-uniq-0066-00', flare: 'card-00021-5-uniq-0064-00',
  watame: 'card-00026-5-uniq-0065-00', towa: 'card-00027-5-uniq-0022-00', ayame: 'card-00010-5-uniq-0010-00'
};
export function planChallenges() {
  const catalog = 'analysis/unit-score/observation-catalog-AT-20260909.json';
  const subsetPath = 'analysis/unit-score/validation-cards.import.json';
  const arPath = 'analysis/unit-score/observations/AR-20260909.json';
  const ar = read(arPath), catalogEntries = collectCatalog(catalog);
  const cards = new Map(read('data/generated/cards.json').map(c => [c.id, c]));
  const profiles = new Map(read(subsetPath).ownedCards.map(p => [p.id, p]));
  ar.profiles.forEach(p => profiles.set(p.id, p));
  const oldSets = new Set(catalogEntries.map(o => [...o.memberIds].sort().join(',')));
  const boardPath = 'analysis/unit-score/board-context.json', boardEvidence = read(boardPath);
  const allBoards = Object.fromEntries(boardEvidence.members.map(m => [m.characterId,
    { rate: Number(m.activationRateUpNodesPct.reduce((s, v) => s + v, 0).toFixed(9)),
      cooldown: Number(m.cooldownShortenNodesPct.reduce((s, v) => s + v, 0).toFixed(9)) }]));
  allBoards['chr-00022'] = { rate: 17.8, cooldown: 0 };
  allBoards['chr-06002'] = { rate: 0, cooldown: 0 };
  allBoards['chr-00010'] = { rate: 0, cooldown: 0 };
  const definitions = [
    { sampleId: 'AV', memberIds: [ids.suisei, ids.noel, ids.kanade, ids.flare, ids.towa],
      purpose: 'A new positive-passive formation where both selected precision sites are necessary among the tracked alternatives: selected board10.3 versus old/value-only/denominator-only10.2.',
      changes: 'From AR replace Ayame with swimsuit Suisei, regular Flare with swimsuit Flare, and swimsuit Kanade with regular Kanade. Keep Towa and swimsuit Noel. Use the explicit listed order.' },
    { sampleId: 'AW', memberIds: [ids.suisei, ids.noel, ids.kanade, ids.flare, ids.watame],
      purpose: 'Replace only AV Towa with swimsuit Watame, adding another support source and frequency4% under the documented character boards. Tests larger overlapping passive totals and different timed overlaps.',
      changes: 'From AV replace slot5 Towa70/0 with swimsuit Watame70/1. Keep the other four cards and their board settings.' },
    { sampleId: 'AX', memberIds: [ids.ayame, ids.towa, ids.noel, ids.suisei, ids.kanadeSwim],
      purpose: 'New zero-score-support-passive formation. Tests whether the same rounded increment continues to yield board10.8 with a zero passive allocation. The prior endpoint-only model gives10.7.',
      changes: 'From the recorded AR card set replace regular Flare11/0 with swimsuit Suisei60/0. Retain swimsuit Kanade40/0, not the regular Kanade80/0 used in AV/AW.' }
  ];
  const alternatives = [
    { name: 'previous endpoints only', engine: {} },
    { name: 'value rounding only', engine: { stage: 'value', digits: 1, mode: 'ceil' } },
    { name: 'denominator rounding only', engine: { stage: 'denominator', digits: 3, mode: 'floor' } }
  ];
  const plans = definitions.map(d => {
    const o = { sampleId: d.sampleId, leaderId: ids.leader, memberIds: d.memberIds,
      profiles: [ids.leader, ...d.memberIds].map(id => profiles.get(id)),
      boardOverrides: Object.fromEntries(d.memberIds.map(id => [cards.get(id).character_id, allBoards[cards.get(id).character_id]])) };
    assert.ok(o.profiles.every(Boolean));
    assert.equal(new Set(d.memberIds.map(id => cards.get(id).character_id)).size, 5);
    assert.equal(oldSets.has([...o.memberIds].sort().join(',')), false);
    const f = allocationFeatures(o), prediction = selectedPrediction(f), a = displayedActiveFeatures(o), sp = quantizedSupportSP(a);
    return { ...o, status: 'Planned; no measurement received', observationsReceived: [],
      leaderSupportNodesPct: [6.2, 4, 3.1], leaderSupportPct: 13.3, leaderJudgmentEnabled: true,
      measurementView: 'Formation detail before song selection',
      leader: { id: ids.leader, name: cards.get(ids.leader).name, character: cards.get(ids.leader).character_name, ...profiles.get(ids.leader) },
      members: d.memberIds.map(id => ({ id, name: cards.get(id).name, character: cards.get(id).character_name, ...profiles.get(id) })),
      purpose: d.purpose, changes: d.changes,
      prediction: { memberParameter: a.power.memberParameter, outfitPower: a.power.outfit, passivePower: a.power.passive,
        active: a.A, special: sp.display, passive: prediction.passive, board: prediction.board },
      alternatives: alternatives.map(c => { const p = selectedPrediction(f, c.engine); return { ...c, passive: p.passive, board: p.board, rawBP: p.sums.BP }; }),
      diagnostic: { rawBP: prediction.sums.BP, roundedIncrement: prediction.roundedIncrement,
        supportByMember: Object.fromEntries(f.features.map(m => [m.id, m.s])),
        activeConditions: a.conditions.active, passiveScoreRowExpected: f.features.some(m => m.s > 0),
        nearBoundaryNote: 'These cases are deliberately selected near display boundaries. Reconfirm all card levels and board values on a mismatch; do not correct the formula per case.' },
      requestedMeasurements: ['passive score (or row absent)', 'board score', 'active score', 'SP score', 'member parameter', 'outfit power', 'passive power'],
      unpredicted: ['board/memory/enhancement power', 'overall power total', 'total score bonus with unmodeled rows', 'final unit score', 'played-song score'] };
  });
  return { schemaVersion: 1, status: 'Prospective planned controls; no new game observations', observedThrough: 'AT',
    previousObservations: 44, futureSampleIds: plans.map(p => p.sampleId), plans,
    selectedEngine, formulaCommit: '23827b5', formulaStatus: 'Frozen 40-case retrospective candidate; do not fit these future outcomes before grading.',
    selection: { approach: 'Enumerated distinct-character five-card combinations in the documented validation subset at AR-compatible Noel/Kanade settings. Omitted the23 previously observed member sets.',
      newSetsExamined: 124, choice: 'AV separates both-site rounding from every tracked alternative; AW adds support overlap with one card replacement; AX tests zero passive with one replacement from AR.',
      limitations: 'This is a documented validation subset, not the whole original personal inventory. Predictions were used to choose informative cases; no future outcome was available.' },
    execution: { firstRequested: 'AV', later: ['AW', 'AX'], AU: 'Still unobserved; existing judgment OFF plan preserved but not executed by this request.',
      noelOnRateNodesPct: [11.1, 3.7, 3], noelOffRateNodesPct: [3.7, 2], noelFrequencyOffPct: 4,
      kanadeOffRateNodesPct: [15, 5], flareOnRateNodesPct: [6],
      watameForAW: { rateNodesPct: [11.1, 3.7, 3, 3, 3.7], sumPct: 24.5, frequencyPct: 4 },
      judgment: 'Keep the Ririka judgment node ON as requested in AR. If AU was executed separately, restore it before AV/AW/AX.',
      dependencies: 'If a target board state cannot be reached without changing other score-relevant nodes, report that before counting the control. Do not spend growth resources to match a profile; report a profile difference.',
      rawInput: 'Store each new user reply separately. Grade against these predictions; leave unreported values null. An absent passive score row may be normalized to0 for comparison without inventing a numeric observation.' },
    provenance: { catalog, catalogSHA256: hash(catalog), subsetPath, subsetSHA256: hash(subsetPath), arPath, arSHA256: hash(arPath),
      boardPath, boardSHA256: hash(boardPath),
      sourceHashes: Object.fromEntries(['analysis/unit-score/probe-expanded-at-20260909.mjs', 'analysis/unit-score/expanded-kernel-at-20260909.mjs',
        'analysis/unit-score/reports/expanded-AT-20260909.json', 'analysis/unit-score/probe-proportional-allocation-20260909.mjs',
        'analysis/unit-score/probe-sp-displayed-active-20260909.mjs', 'analysis/unit-score/compare-sp-v-rounding-20260909.mjs',
        'analysis/unit-score/board-observations/noel-node-dependency-20260909.json',
        'analysis/unit-score/board-observations/ririka-X-20260909.json'].map(p => [p, hash(p)])),
      analysisSourceSHA256: hash('analysis/unit-score/plan-challenges-av-ax-20260909.mjs') }, productionFormulaChanged: false };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(planChallenges(), null, 2));
