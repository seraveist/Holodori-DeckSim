import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { outputRoot } from '../analysis/unit-score/io.mjs';
const compare = (actual, expected, label) => {
  if (typeof expected === 'number') assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
  else if (expected && typeof expected === 'object') {
    assert.ok(actual && typeof actual === 'object', label);
    assert.deepEqual(Object.keys(actual), Object.keys(expected), label);
    for (const key of Object.keys(expected)) compare(actual[key], expected[key], `${label}.${key}`);
  } else assert.equal(actual, expected, label);
};
const cases = [{ file: 'fixed-constant-fits-20260909-v2.json', keys: ['passive', 'outfit', 'special'] }];
if (process.argv.includes('--grid')) cases.push(
  { file: 'dummy-active-joint-probes.json', keys: ['candidates', 'originalACMatches', 'allMatches'] },
  { file: 'dummy-environment-probes.json', keys: ['activeVariants', 'phaseVariants', 'passive', 'outfit', 'specialVariants', 'specialBounds'] },
  { file: 'dummy-identifiability-probes.json', keys: ['combo', 'spGlobal', 'spWindowBounds', 'outfitVariants'] },
);
for (const { file, keys } of cases) {
  const expected = JSON.parse(fs.readFileSync(new URL(`../analysis/unit-score/archive/${file}`, import.meta.url), 'utf8'));
  const actual = JSON.parse(fs.readFileSync(path.join(outputRoot, file), 'utf8'));
  for (const key of keys) compare(actual[key], expected[key], `${file}.${key}`);
}
console.log(`research reproduction: ${cases.length} archived numerical checkpoints match (timestamps/source hashes excluded)`);
