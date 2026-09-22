import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  roleSchema,
  userSchema,
  sessionSchema,
  pageInfoSchema,
  paginatedSchema,
  noContentSchema,
} from '../dist/client.js';

const canonicalUser = {
  id: 'user_7f3a',
  email: 'host@venue.com',
  displayName: 'Ayesha Rao',
  role: 'partner',
  avatarUrl: null,
};

test('roleSchema accepts every canonical role and rejects others', () => {
  for (const role of ['guest', 'partner', 'admin']) {
    assert.equal(roleSchema.parse(role), role);
  }
  assert.equal(roleSchema.safeParse('superadmin').success, false);
  assert.equal(roleSchema.safeParse('').success, false);
});

test('userSchema parses a canonical fixture', () => {
  const parsed = userSchema.parse(canonicalUser);
  assert.deepEqual(parsed, canonicalUser);
});

test('userSchema rejects a corrupt user', () => {
  const result = userSchema.safeParse({ ...canonicalUser, email: 'not-an-email' });
  assert.equal(result.success, false);
  const invalidRole = userSchema.safeParse({ ...canonicalUser, role: 'god' });
  assert.equal(invalidRole.success, false);
});

test('userSchema validates url avatar when present', () => {
  const withAvatar = userSchema.parse({
    ...canonicalUser,
    avatarUrl: 'https://cdn.example.com/a.png',
  });
  assert.equal(withAvatar.avatarUrl, 'https://cdn.example.com/a.png');
  const bad = userSchema.safeParse({ ...canonicalUser, avatarUrl: 'nope' });
  assert.equal(bad.success, false);
});

test('sessionSchema parses a canonical session', () => {
  const session = sessionSchema.parse({
    user: canonicalUser,
    expiresAt: 1780000000000,
  });
  assert.equal(session.expiresAt, 1780000000000);
  assert.equal(session.user.role, 'partner');
});

test('pageInfoSchema parses canonical page info and rejects negatives', () => {
  const info = pageInfoSchema.parse({ page: 0, pageSize: 20, total: 0, hasNextPage: false });
  assert.equal(info.page, 0);
  const bad = pageInfoSchema.safeParse({ page: -1, pageSize: 20, total: 0, hasNextPage: false });
  assert.equal(bad.success, false);
});

test('paginatedSchema wraps items with pageInfo', () => {
  const schema = paginatedSchema(userSchema);
  const parsed = schema.parse({
    items: [canonicalUser],
    pageInfo: { page: 1, pageSize: 20, total: 1, hasNextPage: false },
  });
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.pageInfo.total, 1);
  const bad = schema.safeParse({
    items: [{ bad: true }],
    pageInfo: { page: 1, pageSize: 1, total: 1, hasNextPage: false },
  });
  assert.equal(bad.success, false);
});

test('noContentSchema accepts undefined only', () => {
  assert.equal(noContentSchema.parse(undefined), undefined);
  assert.equal(noContentSchema.safeParse(null).success, false);
  assert.equal(noContentSchema.safeParse({}).success, false);
});
