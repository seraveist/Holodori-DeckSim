// A shared, assumed chart for choosing one representative order when no song
// is selected. This is not the game's formation-screen evaluation formula.
const duration = 110;
const noteCount = 800;
const notes = Array.from({ length: noteCount }, (_, i) => Object.freeze(["tap", (i + 1) * duration / noteCount]));
const skills = Array.from({ length: 5 }, (_, i) => Object.freeze({
  slot: i + 1,
  time: (i + 1) * duration / 6,
  combo: Math.floor((i + 1) * noteCount / 6),
}));

export const ORDER_REFERENCE = Object.freeze({
  id: "generic-order-110s-800-v1",
  duration,
  noteCount,
  specialTimes: Object.freeze(skills.map(skill => skill.time)),
});

export const ORDER_REFERENCE_MUSIC = Object.freeze({
  id: ORDER_REFERENCE.id,
  title: "공통 배치 비교 채보",
  playing_seconds: duration,
  live_score_coefficient_permil: 5,
  _chart: Object.freeze({
    fullComboNoteCount: noteCount,
    chartHash: ORDER_REFERENCE.id,
    metadata: Object.freeze({ notes: Object.freeze(notes), skills: Object.freeze(skills), fever: null }),
  }),
});
