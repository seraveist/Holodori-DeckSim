// Measured reference for the formation-screen Active category, not Live Score.
// Selected using A/C; D was predicted before its screenshot was received.
// Not connected to production until passive/SP attribution is calibrated.
// Combo-conditioned Actives and leader support have not been measured here.
export const ACTIVE_REFERENCE_VERSION = 'unit-active-200s-weighted-v1';
export function probeActiveReference(members) {
  const ordered = [...members].sort((a, b) => a.id.localeCompare(b.id));
  const values = ordered.map(m => {
    const a = m.active;
    if (![a.interval, a.duration, a.probability, a.baseScoreUp, a.conditionalScoreUp].every(Number.isFinite)
        || a.interval <= 0 || a.duration < 0 || a.probability < 0 || a.probability > 1) {
      throw new Error(`Invalid active profile: ${m.id}`);
    }
    const c = a.condition;
    let met = true;
    if (c?.kind === 'attribute') met = members.filter(x => x.attribute === c.value).length >= c.count;
    else if (c?.kind === 'group') met = members.filter(x => x.groupings.has(c.value)).length >= c.count;
    else if (c?.kind === 'life') met = c.threshold <= 1000;
    else if (c) throw new Error(`Unmeasured active condition: ${c.kind}`);
    return met ? a.conditionalScoreUp : a.baseScoreUp;
  });
  let sum = 0;
  const contributions = Object.fromEntries(ordered.map(m => [m.id, 0]));
  for (let time = 1; time <= 200; time++) {
    let probabilitySum = 0;
    const indices = [];
    ordered.forEach((m, i) => {
      if (time >= m.active.interval && time % m.active.interval < m.active.duration) {
        indices.push(i);
        probabilitySum += m.active.probability;
      }
    });
    for (const i of indices) {
      const m = ordered[i];
      const contribution = values[i] * m.active.probability / Math.max(1, probabilitySum) / 200;
      sum += contribution;
      contributions[m.id] += contribution;
    }
  }
  return { raw: sum, display: Math.ceil((sum - 1e-10) * 10) / 10, contributions };
}
