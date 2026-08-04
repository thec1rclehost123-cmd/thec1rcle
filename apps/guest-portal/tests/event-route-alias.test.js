import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const aliasPath = fileURLToPath(new URL('../app/events/[id]/page.jsx', import.meta.url));

test('plural event detail route redirects to the canonical event page', () => {
  const source = readFileSync(aliasPath, 'utf8');

  assert.match(source, /redirect\(`\/event\/\$\{encodeURIComponent\(id\)\}`\)/);
  assert.match(source, /const \{ id \} = await params/);
});
