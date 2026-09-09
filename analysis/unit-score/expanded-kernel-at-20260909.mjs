// Research-only model. No sample-specific correction or production changes.
// Each time sample uses the same first-proc and endpoint convention as the frozen 200-second kernel.
export const modes=['ceil','floor','round'];
export const q=(v,mode='ceil',digits=1)=>Math[mode](v*10**digits+(mode==='ceil'?-1e-8:mode==='floor'?1e-8:0))/10**digits+0;
export function model(row,c={}) {
  const points={A:[],P:[],B:[],BP:[]}, sums={A:0,P:0,B:0,BP:0}, per={A:[0,0,0,0,0],B:[0,0,0,0,0],BP:[0,0,0,0,0],P:[0,0,0,0,0]};
  const quant=(v,stage)=>{const site=(c.sites??[c]).find(s=>s.stage===stage);return site?q(v,site.mode,site.digits):v;};
  for (const state of ['A','P','B','BP']) {
    const board=state.includes('B'), passive=state.includes('P');
    const members=row.features.map(m=>{
      let p=board?Math.min(1,m.p*(1+m.r/100)):m.p;
      p=quant(p*100,'probabilityPercent')/100;
      let I=quant(board?m.I/(1+m.f/100):m.I,'interval');
      let v=m.v*(c.stacking==='product'?(1+(board?m.L:0)/100)*(1+(passive?m.s:0)/100):1+((board?m.L:0)+(passive?m.s:0))/100);
      v=quant(v,'value');
      if(c.stage==='float32Inputs') {p=Math.fround(p);v=Math.fround(v);I=Math.fround(I);}
      return {...m,p,I,v};
    });
    for(let t=1;t<=200;t++) {
      const on=members.map(m=>t>=m.I&&t-Math.floor((t+1e-9)/m.I)*m.I<m.d-1e-9);
      const ps=members.reduce((s,m,i)=>s+(on[i]?m.p:0),0);
      const denom=Math.max(1,quant(ps,'denominator'));
      const contributions=members.map((m,i)=>on[i]?quant(quant(m.p*m.v,'numeratorMember')/denom,'normalizedMember'):0);
      const point=quant(contributions.reduce((a,b)=>a+b,0),'tick');
      points[state].push(point);sums[state]+=point/200;
      contributions.forEach((v,i)=>per[state][i]+=v/200);
    }
    if(c.stage==='integratedMember') sums[state]=per[state].reduce((s,v)=>s+q(v,c.mode,c.digits),0);
  }
  return {sums,points,per};
}
export function ratio(row,countMode='fractional',boardMode='multiplicative',passiveMode='plain',timeWeights=null) {
  let PW=0,BW=0;
  row.features.forEach((m,i)=>{
    const w=timeWeights?timeWeights[i]:m.p*m.v*(countMode==='fractional'?m.d/m.I:countMode==='floor'?m.d*Math.floor(200/m.I)/200:Array.from({length:200},(_,j)=>j+1>=m.I&&(j+1-Math.floor((j+1+1e-9)/m.I)*m.I<m.d-1e-9)?1:0).reduce((a,b)=>a+b,0)/200);
    const b=boardMode==='multiplicative'?100*((1+m.r/100)*(1+m.f/100)*(1+m.L/100)-1):boardMode==='additive'?m.r+m.f+m.L:100*((1+m.r/100)*(1+m.f/100)-1)+m.L;
    const s=m.s*(passiveMode==='plain'?1:passiveMode==='afterTiming'?(1+m.r/100)*(1+m.f/100):passiveMode==='afterLeader'?1+m.L/100:(1+m.r/100)*(1+m.f/100)*(1+m.L/100));
    PW+=w*s;BW+=w*b;
  });return PW/(PW+BW);
}
export function increment(A,BP,pool){
  if(pool==='raw')return BP-A;
  if(pool.startsWith('delta-'))return q(BP-A,pool.slice(6));
  const mode=pool.slice(5);return q(BP,mode)-q(A,mode);
}
