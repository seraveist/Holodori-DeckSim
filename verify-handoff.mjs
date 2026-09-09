// Git-checkout entry point. The original ZIP inventory verifier is archived
// under analysis/unit-score/imports/20260909-aj for transfer provenance.
import { verifyAJHandoff } from './scripts/test-validation-aj-handoff.mjs';
import { verifyAK } from './scripts/test-validation-ak.mjs';
import { verifyALPlan } from './scripts/test-validation-al-plan.mjs';
import { verifyAL } from './scripts/test-validation-al.mjs';
const previous = verifyAJHandoff();
verifyAK();
verifyALPlan();
console.log(JSON.stringify({ ...verifyAL(), preservedAJCheckpoint: previous }, null, 2));
