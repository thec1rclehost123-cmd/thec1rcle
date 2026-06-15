import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('Phase 6 architecture boundaries', () => {
  it('moves public discovery bootstrap off gateway startup and onto an explicit backfill command', () => {
    const firebasePlugin = readFileSync(path.join(root, 'src/plugins/firebase.ts'), 'utf8');
    const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const backfillScript = readFileSync(
      path.join(root, 'src/scripts/backfill-public-discovery.ts'),
      'utf8',
    );

    expect(firebasePlugin.includes('bootstrapReadModels(')).toBe(false);
    expect(packageJson.scripts['backfill:public-discovery']).toBeTruthy();
    expect(backfillScript.includes('bootstrapReadModels(console)')).toBe(true);
  });

  it('keeps the health endpoint read-only for Firestore checks', () => {
    const appSource = readFileSync(path.join(root, 'src/app.ts'), 'utf8');

    expect(appSource.includes("collection('health_checks')")).toBe(false);
    expect(appSource.includes("collection('system_meta').doc('public_discovery').get()")).toBe(
      true,
    );
  });
});
