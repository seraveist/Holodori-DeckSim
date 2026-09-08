import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { prepared, fixture } from './validation-data.mjs';
import { integrate, round1 } from './dummy-model-lab.mjs';
import { evaluateDeck, prepareDeckComposition, SCORE_ENGINE_VERSION } from '../../js/score.js';
import { sourceLock } from './io.mjs';
const read = name => JSON.parse(fs.readFileSync(new URL(name, import.meta.url), 'utf8'));
const coefficients = read('archive/fixed-constant-fits-20260909-v2.json');
const displayCandidates = raw => ({ raw, ceil: round1(raw, 'ceil'), round: round1(raw, 'round'), floor: round1(raw, 'floor') });
export function predictNext() {
  return { schemaVersion: 1, status: 'unobserved predictions; hypotheses, not guaranteed game values',
    engineVersion: SCORE_ENGINE_VERSION, masterSource: fixture.masterSource, sourceHashes: sourceLock(),
    coefficientSource: 'archive/fixed-constant-fits-20260909-v2.json (frozen; not refitted to future observations)',
    predictions: read('next-experiments.json').experiments.map(e => {
      const leader = prepared.get(e.leaderId), members = e.memberIds.map(id => prepared.get(id));
      const composition = prepareDeckComposition({ leader, members });
      if (!composition) throw new Error(`Invalid proposed formation: ${e.id}`);
      const team = { members, support: members.map(m => composition.passive.supportByMember[m.id]) };
      const active = integrate(team), passive = integrate(team, { passive: true }) - active;
      let supportPart = 0, ratePart = 0;
      for (const m of members) {
        const sp = { ...m.special, duration: 201 };
        const rateOnly = integrate(team, { sp: { ...sp, support: 0 }, spStart: 0 });
        const both = integrate(team, { sp, spStart: 0 });
        supportPart += (both - rateOnly) * m.special.duration / 200;
        ratePart += (rateOnly - active) * m.special.duration / 200;
      }
      const outfitSupport = composition.leaderEffects.support;
      const outfitBase = active * outfitSupport / 100;
      const spCoefficients = coefficients.special.separateSupportAndRate.coefficients;
      const passiveCoefficients = coefficients.passive.leaderInteractionDiagnostic.coefficients;
      const engine = evaluateDeck({ leader, members });
      return { id: e.id, leaderId: e.leaderId, memberIds: e.memberIds,
        profiles: [e.leaderId, ...e.memberIds].map(id => fixture.profiles.find(p => p.id === id)),
        requiresConfirmation: e.requiresConfirmation,
        engine: { power: engine.detail.power, retainedPower: engine.overallPower, bonus: engine.detail.scoreBonus,
          retainedBonus: engine.scoreBonusPct, derivedUnitScore: engine.unitScore },
        research: { active: displayCandidates(active),
          passiveSingle: displayCandidates(passive * coefficients.passive.single.coefficients[0]),
          passiveLeaderInteraction: displayCandidates(passive * (passiveCoefficients[0] + passiveCoefficients[1] * outfitSupport / 100)),
          specialSingle: displayCandidates((supportPart + ratePart) * coefficients.special.single.coefficients[0]),
          specialTwoCoefficients: displayCandidates(supportPart * spCoefficients[0] + ratePart * spCoefficients[1]),
          outfitSingle: displayCandidates(outfitBase * coefficients.outfit.single.coefficients[0]),
          outfitScaledFromI: displayCandidates(outfitBase * (39 / coefficients.outfit.single.training.values[0].x[0])),
          outfitScaledFromJ: displayCandidates(outfitBase * (41.5 / coefficients.outfit.single.training.values[1].x[0])),
          inputs: { activeMean: active, passiveMarginal: passive, outfitSupport, supportPart, ratePart } },
      };
    }) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(predictNext(), null, 2));
