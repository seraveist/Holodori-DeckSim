# Portable unit-score research

Start with [SCORING_HANDOFF.md](../../SCORING_HANDOFF.md). Node.js 24+, no npm packages and no private inventory file are required.

| File | Purpose |
|---|---|
| `validation-data.mjs` | Prepares real current master cards using the 11 portable profiles in `scripts/fixtures/unit-observations-20260908.json`; adapts historical observation shape |
| `dummy-model-lab.mjs` | Analysis-only weighted/maximum Active kernels, SP window candidates and known board inputs |
| `unit-active-reference.mjs` | Preserved earlier Active reference; rejects combo conditions rather than silently inferring them |
| `probe-dummy-active-joint.mjs` | 212,688 duration/timing/aggregation/rounding candidates |
| `probe-dummy-environment.mjs` | Active/passive/outfit probes and 92 fixed SP-grid candidates |
| `probe-dummy-identifiability.mjs` | Conditional combo bound, SP denominator/window bounds and outfit candidates |
| `probe-fixed-constants.mjs` | One/two coefficient fits, retrospective splits and rounding-interval feasibility |
| `next-experiments.json` / `predict-next.mjs` | L/M/N definitions and reproducible predictions using frozen fitted coefficients |
| `experiment.mjs` | Creates a local blank observation and compares measured values against the frozen predictions |
| `archive/` | Read-only historical numerical checkpoints and unobserved future predictions; do not regenerate in place |
| `board-context.json` | User-confirmed relevant nodes; not a full board export |
| `validation-cards.import.json` | Importable 11-card validation subset; not the full personal inventory |

Run `node scripts/run-scoring-validation.mjs` from the repository root. Add `--research-grid` for all grid probes. Output is in `.local/scoring-validation/research/`, independent of current working directory. Individual probes can also be run with Node from the root. The probe output timestamps and provenance hashes can differ from historical archives; numerical comparison, not byte identity, is the reproducibility criterion. New hashes normalize JSON whitespace and source line endings for portability. Archived hashes retain historical local provenance and do not require those historical source files to be present.

The same current master is used by the production calculator and portable input adapter. The checked-in branch captures the observed master version. Unrelated future master additions should not affect profiles; changed card formulas may make the regression or frozen prediction comparison fail. Record that drift instead of updating old observations to match it.

The archived environment and fits were selected retrospectively. Physical tick, note count, SP points and complete category attribution remain unidentified. Omitted category values are `null` in the portable fixture; the first legacy coefficient report counted omitted zeros in residual statistics, so only v2 is retained here. The portable v2 fit excludes those omitted categories. No research module is imported by the production app.

Primary third-party implementation notes consulted: [Live mechanics](https://dreams.wf-calc.net/en/wiki/live). These are the calculator author's Live explanation, not an official specification of the game's formation-screen formula. They do not establish a 200-second evaluation period.
