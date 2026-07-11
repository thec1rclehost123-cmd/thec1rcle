import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rules = readFileSync(
  fileURLToPath(new URL('../../../firestore.rules', import.meta.url)),
  'utf8',
);

describe('consumer trusted-field Firestore boundary', () => {
  it('does not allow client phone aliases and evaluates only the update delta', () => {
    const createAllowlist =
      rules.match(/function hasOnlyAllowedUserFields[\s\S]*?\n    }/)?.[0] || '';
    const updateAllowlist =
      rules.match(/function updateHasOnlyAllowedUserFields[\s\S]*?\n    }/)?.[0] || '';

    expect(createAllowlist).not.toContain("'phone'");
    expect(createAllowlist).not.toContain("'phoneNumber'");
    expect(updateAllowlist).not.toContain("'phone'");
    expect(updateAllowlist).not.toContain("'phoneNumber'");
    expect(rules).toContain(
      'updateHasOnlyAllowedUserFields(request.resource.data.diff(resource.data))',
    );
  });
});
