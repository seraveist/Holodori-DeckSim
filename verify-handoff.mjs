// Git-checkout entry point. The original ZIP inventory verifier is archived
// under analysis/unit-score/imports/20260909-aj for transfer provenance.
import { verifyAJHandoff } from './scripts/test-validation-aj-handoff.mjs';
console.log(JSON.stringify(verifyAJHandoff(), null, 2));
