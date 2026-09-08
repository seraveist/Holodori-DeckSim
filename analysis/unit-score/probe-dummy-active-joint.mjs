import { writeResult } from './io.mjs';
import { teams, kernel, round1 } from './dummy-model-lab.mjs';
const samples = teams.filter(t => !['I','J'].includes(t.id));
const allMatches = [], originalACMatches = [];
let candidates = 0;
// Prefix sums permit a joint grid over durations and sampling conventions,
// rather than only testing other conventions at the already-selected 200s.
for (const firstImmediate of [false, true]) for (const offset of [-3,-2,-1,0,1,2,3]) {
  for (const aggregation of ['weighted','maximum']) for (const step of [0.1,0.5,1,2]) {
    for (const samplePhase of [0,0.5,1]) {
      const prefixes = samples.map(t => {
        const sums = [0];
        for (let i=0; i<300/step; i++) sums.push(sums.at(-1) + kernel(t, (i+samplePhase)*step,
          { firstImmediate, offset, aggregation }));
        return sums;
      });
      for (let duration=60; duration<=300; duration++) {
        const n = Math.round(duration/step);
        if (Math.abs(n*step-duration)>1e-8) continue;
        const raw = prefixes.map(p=>p[n]/n);
        for (const rounding of ['floor','round','ceil']) {
          candidates++;
          const values=raw.map(x=>round1(x,rounding));
          if (values[0]!==samples[0].game.active || values[1]!==samples[1].game.active) continue;
          const candidate={duration,firstImmediate,offset,aggregation,step,samplePhase,rounding,raw,values};
          originalACMatches.push(candidate);
          if(values.every((v,i)=>v===samples[i].game.active)) allMatches.push(candidate);
        }
      }
    }
  }
}
const output={recordedAt:new Date().toISOString(), status:'Joint retrospective discrete grid; no fresh held-out observations',
  grid:{duration:'60..300 integer seconds',firstImmediate:[false,true],offset:[-3,-2,-1,0,1,2,3],
    aggregation:['weighted','maximum'],step:[0.1,0.5,1,2],samplePhase:[0,0.5,1],rounding:['floor','round','ceil']},
  candidates,originalACMatches,allMatches,
  note:'Offsets shift both activation phase and first-check threshold; only relative sampling times are identifiable. Equivalent translations are not distinct physical evidence. Integer durations and these kernels only; arbitrary note distributions and fractional durations are outside the search.'};
writeResult('dummy-active-joint-probes.json', output);
console.log(JSON.stringify({candidates,fitAC:originalACMatches.length,allMatches},null,2));
