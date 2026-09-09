// Git-checkout entry point. The original ZIP inventory verifier is archived
// under analysis/unit-score/imports/20260909-aj for transfer provenance.
import { verifyAJHandoff } from './scripts/test-validation-aj-handoff.mjs';
import { verifyAK } from './scripts/test-validation-ak.mjs';
import { verifyALPlan } from './scripts/test-validation-al-plan.mjs';
import { verifyAL } from './scripts/test-validation-al.mjs';
import { verifyAMAN } from './scripts/test-validation-am-an.mjs';
import { verifyAO } from './scripts/test-validation-ao.mjs';
import { verifyAPPlan } from './scripts/test-validation-ap-plan.mjs';
import { verifyAP } from './scripts/test-validation-ap.mjs';
import { verifyAQPlan } from './scripts/test-validation-aq-plan.mjs';
import { verifyAQ } from './scripts/test-validation-aq.mjs';
import { verifyARPlan } from './scripts/test-validation-ar-plan.mjs';
import { verifyAR } from './scripts/test-validation-ar.mjs';
import { verifyASPlan } from './scripts/test-validation-as-plan.mjs';
const previous = verifyAJHandoff();
verifyAK();
verifyALPlan();
verifyAL();
verifyAMAN();
verifyAO();
verifyAPPlan();
verifyAP();
verifyAQPlan();
verifyAQ();
verifyARPlan();
console.log(JSON.stringify({ ...verifyAR(), nextPlan: verifyASPlan(), preservedAJCheckpoint: previous }, null, 2));
