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
    for (const trustedField of [
      'phoneNumberE164',
      'phoneVerifiedAt',
      'auth',
      'consumerOnboarding',
      'onboardingComplete',
      'profileVersion',
    ]) {
      expect(createAllowlist).not.toContain(`'${trustedField}'`);
      expect(updateAllowlist).not.toContain(`'${trustedField}'`);
    }
    expect(rules).toContain(
      'updateHasOnlyAllowedUserFields(request.resource.data.diff(resource.data))',
    );
  });

  it('gates sensitive reads by verified Firebase phone and keeps mutations server-owned', () => {
    expect(rules).toContain(
      'function hasVerifiedPhone() {\n      return isSignedIn() && request.auth.token.phone_number != null;',
    );

    for (const collection of [
      'orders',
      'cart_reservations',
      'userLikes',
      'userMatches',
      'eventGroupMessages',
      'privateConversations',
      'share_bundles',
      'transfers',
      'rsvp_orders',
    ]) {
      const block =
        rules.match(new RegExp(`match /${collection}\\/\\{[^}]+\\} \\{[\\s\\S]*?\\n    \\}`))?.[0] ||
        '';
      expect(block, `${collection} rules must exist`).not.toBe('');
      expect(block, `${collection} must use verified-phone or deny all client access`).toMatch(
        /hasVerifiedPhone\(\)|allow read, write: if false/,
      );
    }

    for (const collection of [
      'orders',
      'cart_reservations',
      'userLikes',
      'userPasses',
      'userMatches',
      'eventGroupMessages',
      'privateConversations',
      'transfers',
      'rsvp_orders',
    ]) {
      const block =
        rules.match(new RegExp(`match /${collection}\\/\\{[^}]+\\} \\{[\\s\\S]*?\\n    \\}`))?.[0] ||
        '';
      expect(block).toMatch(/allow (create|create, update|create, update, delete): if false/);
    }
  });
});
