import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
export const outputRoot = path.join(repositoryRoot, '.local', 'scoring-validation', 'research');
export function writeResult(name, value) {
  if (path.basename(name) !== name) throw new Error('Result name must be a filename');
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.writeFileSync(path.join(outputRoot, name), JSON.stringify(value, null, 2) + '\n');
}
export function sourceLock() {
  const files = ['scripts/fixtures/unit-observations-20260908.json', 'analysis/unit-score/board-context.json',
    'data/generated/cards.json', 'data/generated/characters.json', 'data/generated/master_refs.json',
    'js/score.js', 'js/order-reference.js', 'analysis/unit-score/dummy-model-lab.mjs'];
  return Object.fromEntries(files.map(file => {
    const text = fs.readFileSync(path.join(repositoryRoot, file), 'utf8');
    // Ignore platform line endings/JSON whitespace for cross-PC provenance.
    const normalized = file.endsWith('.json') ? JSON.stringify(JSON.parse(text)) : text.replaceAll('\r\n', '\n');
    return [file, crypto.createHash('sha256').update(normalized).digest('hex')];
  }));
}
