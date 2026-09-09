import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// Historical forecasts must reproduce with their original engine, not today's
// service. Make an explicit, isolated workspace; do not alter source hashes or
// route production tests through a legacy module.
export function historicalScoringWorkspace(root) {
  const archive = path.join(root, "analysis/unit-score/archive/score-v0.9.js");
  const archived = fs.readFileSync(archive);
  const expected = JSON.parse(fs.readFileSync(path.join(root, "analysis/unit-score/archive/runtime-v0.9.json"), "utf8"));
  if (createHash("sha256").update(archived).digest("hex") !== expected.scoreSHA256) {
    throw new Error("Archived scoring engine bytes changed");
  }
  const parent = path.join(root, ".local/scoring-validation");
  fs.mkdirSync(parent, { recursive: true });
  const workspace = fs.mkdtempSync(path.join(parent, "historical-"));
  for (const directory of ["analysis", "scripts", "js", "data/generated"]) {
    fs.cpSync(path.join(root, directory), path.join(workspace, directory), { recursive: true });
  }
  fs.copyFileSync(archive, path.join(workspace, "js/score.js"));
  return workspace;
}
