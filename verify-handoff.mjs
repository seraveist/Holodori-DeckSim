// Git-checkout entry point. The original ZIP inventory verifier is archived
// under analysis/unit-score/imports/20260909-aj for transfer provenance.
import { verifyAJHandoff } from './scripts/test-validation-aj-handoff.mjs';
import { verifyAK } from './scripts/test-validation-ak.mjs';
const previous = verifyAJHandoff();
console.log(JSON.stringify({ ...verifyAK(), preservedAJCheckpoint: previous }, null, 2));
