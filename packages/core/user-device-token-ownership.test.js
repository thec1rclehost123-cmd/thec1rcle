import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { registerDeviceToken, revokeDeviceToken } from './user-service.js';

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function buildDb(seed = {}) {
  const documents = new Map(Object.entries(seed).map(([path, value]) => [path, clone(value)]));
  const versions = new Map([...documents.keys()].map((path) => [path, 1]));
  const collectionVersions = new Map();

  function collectionPath(documentPath) {
    return documentPath.split('/').slice(0, -1).join('/');
  }

  function increment(path) {
    versions.set(path, (versions.get(path) || 0) + 1);
    const collection = collectionPath(path);
    collectionVersions.set(collection, (collectionVersions.get(collection) || 0) + 1);
  }

  function document(path) {
    return {
      kind: 'document',
      path,
      id: path.split('/').at(-1),
    };
  }

  function collection(path) {
    return {
      kind: 'collection',
      path,
      doc(id) {
        return document(`${path}/${id}`);
      },
      where(field, operator, value) {
        if (operator !== '==') throw new Error(`Unsupported operator ${operator}`);
        return { kind: 'query', path, field, value };
      },
    };
  }

  function documentSnapshot(ref) {
    const value = documents.get(ref.path);
    return {
      exists: value !== undefined,
      id: ref.id,
      ref,
      data: () => clone(value),
    };
  }

  function querySnapshot(query) {
    const prefix = `${query.path}/`;
    const docs = [...documents.entries()]
      .filter(([path, value]) => {
        if (!path.startsWith(prefix)) return false;
        if (path.slice(prefix.length).includes('/')) return false;
        return value?.[query.field] === query.value;
      })
      .map(([path]) => documentSnapshot(document(path)));
    return { docs, empty: docs.length === 0, size: docs.length };
  }

  async function runTransaction(work) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const documentReads = new Map();
      const queryReads = new Map();
      const writes = [];
      const transaction = {
        async get(ref) {
          // Yield so Promise.all registrations exercise optimistic conflicts.
          await Promise.resolve();
          if (ref.kind === 'query') {
            queryReads.set(ref.path, collectionVersions.get(ref.path) || 0);
            return querySnapshot(ref);
          }
          documentReads.set(ref.path, versions.get(ref.path) || 0);
          return documentSnapshot(ref);
        },
        set(ref, value, options = {}) {
          writes.push({ type: 'set', ref, value: clone(value), merge: options.merge === true });
        },
        delete(ref) {
          writes.push({ type: 'delete', ref });
        },
      };

      const result = await work(transaction);
      const hasConflict =
        [...documentReads].some(([path, version]) => (versions.get(path) || 0) !== version) ||
        [...queryReads].some(
          ([path, version]) => (collectionVersions.get(path) || 0) !== version,
        );
      if (hasConflict) continue;

      for (const write of writes) {
        if (write.type === 'delete') {
          documents.delete(write.ref.path);
          increment(write.ref.path);
          continue;
        }
        const previous = documents.get(write.ref.path);
        documents.set(
          write.ref.path,
          write.merge ? { ...(previous || {}), ...clone(write.value) } : clone(write.value),
        );
        increment(write.ref.path);
      }
      return result;
    }
    throw new Error('Transaction retry limit exceeded');
  }

  return {
    collection,
    runTransaction,
    read(path) {
      return clone(documents.get(path));
    },
    entries(prefix) {
      return [...documents.entries()]
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, value]) => [path, clone(value)]);
    },
  };
}

const token = 'ExponentPushToken[shared-physical-device]';
const tokenHash = createHash('sha256').update(token, 'utf8').digest('hex');

function payload(deviceId = 'android-build-1') {
  return {
    token,
    deviceId,
    provider: 'expo',
    platform: 'android',
    projectId: 'project_1',
    appVersion: '1.0.0',
  };
}

describe('device token ownership', () => {
  it('atomically reassigns A to B while preserving unrelated tokens', async () => {
    const db = buildDb({
      'users/user_a': { pushToken: 'other-a', pushTokens: ['other-a'] },
      'users/user_b': { pushToken: 'other-b', pushTokens: ['other-b'] },
    });

    await registerDeviceToken(db, 'user_a', payload());
    const reassigned = await registerDeviceToken(db, 'user_b', payload());

    expect(reassigned).toMatchObject({ success: true, reassigned: true });
    expect(db.read(`deviceTokenClaims/${tokenHash}`)).toMatchObject({
      tokenHash,
      userId: 'user_b',
      deviceId: 'android-build-1',
    });
    expect(`deviceTokenClaims/${tokenHash}`).not.toContain(token);
    expect(db.read('users/user_a')).toMatchObject({
      pushToken: 'other-a',
      pushTokens: ['other-a'],
    });
    expect(db.read('users/user_b')).toMatchObject({
      pushToken: token,
      pushTokens: ['other-b', token],
    });

    const records = db.entries('deviceTokens/').map(([, value]) => value);
    expect(records.filter((record) => record.userId === 'user_a')).toEqual([
      expect.objectContaining({ token: null, tokenHash, isActive: false }),
    ]);
    expect(records.filter((record) => record.userId === 'user_b')).toEqual([
      expect.objectContaining({ token, tokenHash, isActive: true }),
    ]);
  });

  it('replays registration for the same owner without duplicating or erasing other devices', async () => {
    const db = buildDb({
      'users/user_a': { pushToken: 'other-a', pushTokens: ['other-a'] },
    });

    const first = await registerDeviceToken(db, 'user_a', payload());
    const replay = await registerDeviceToken(db, 'user_a', payload());

    expect(first.deviceToken.createdAt).toBe(replay.deviceToken.createdAt);
    expect(replay.reassigned).toBe(false);
    expect(db.read('users/user_a').pushTokens).toEqual(['other-a', token]);
    expect(db.entries('deviceTokens/').filter(([, value]) => value.isActive)).toHaveLength(1);
  });

  it('rotates a token on the same installation without leaving the old claim or mirror active', async () => {
    const db = buildDb({
      'users/user_a': { pushToken: 'other-a', pushTokens: ['other-a'] },
    });
    const rotatedToken = 'ExponentPushToken[rotated-device-token]';
    const rotatedHash = createHash('sha256').update(rotatedToken, 'utf8').digest('hex');
    await registerDeviceToken(db, 'user_a', payload());

    await registerDeviceToken(db, 'user_a', {
      ...payload(),
      token: rotatedToken,
    });

    expect(db.read(`deviceTokenClaims/${tokenHash}`)).toBeUndefined();
    expect(db.read(`deviceTokenClaims/${rotatedHash}`)).toMatchObject({ userId: 'user_a' });
    expect(db.read('users/user_a')).toMatchObject({
      pushToken: rotatedToken,
      pushTokens: ['other-a', rotatedToken],
    });
    expect(db.entries('deviceTokens/').map(([, value]) => value)).toEqual([
      expect.objectContaining({ token: rotatedToken, tokenHash: rotatedHash, isActive: true }),
    ]);
  });

  it('converges concurrent A and B registration on exactly one owner and one active record', async () => {
    const db = buildDb({
      'users/user_a': { pushTokens: ['other-a'] },
      'users/user_b': { pushTokens: ['other-b'] },
    });

    await Promise.all([
      registerDeviceToken(db, 'user_a', payload()),
      registerDeviceToken(db, 'user_b', payload()),
    ]);

    const claim = db.read(`deviceTokenClaims/${tokenHash}`);
    expect(['user_a', 'user_b']).toContain(claim.userId);
    const otherUserId = claim.userId === 'user_a' ? 'user_b' : 'user_a';
    expect(db.read(`users/${claim.userId}`).pushTokens).toContain(token);
    expect(db.read(`users/${otherUserId}`).pushTokens).not.toContain(token);
    const active = db
      .entries('deviceTokens/')
      .map(([, value]) => value)
      .filter((record) => record.isActive && record.token === token);
    expect(active).toHaveLength(1);
    expect(active[0].userId).toBe(claim.userId);
  });

  it('does not let an old owner revoke the current owner token', async () => {
    const db = buildDb({
      'users/user_a': { pushTokens: [] },
      'users/user_b': { pushTokens: [] },
    });
    await registerDeviceToken(db, 'user_a', payload());
    await registerDeviceToken(db, 'user_b', payload());

    const result = await revokeDeviceToken(db, 'user_a', payload());

    expect(result).toEqual({ success: true, revoked: false, alreadyRevoked: true });
    expect(db.read(`deviceTokenClaims/${tokenHash}`).userId).toBe('user_b');
    expect(db.read('users/user_b').pushTokens).toContain(token);
  });

  it('revokes only caller ownership and treats replay as success', async () => {
    const db = buildDb({
      'users/user_b': { pushToken: 'other-b', pushTokens: ['other-b'] },
    });
    await registerDeviceToken(db, 'user_b', payload());

    const first = await revokeDeviceToken(db, 'user_b', payload());
    const replay = await revokeDeviceToken(db, 'user_b', payload());

    expect(first).toEqual({ success: true, revoked: true, alreadyRevoked: false });
    expect(replay).toEqual({ success: true, revoked: false, alreadyRevoked: true });
    expect(db.read(`deviceTokenClaims/${tokenHash}`)).toBeUndefined();
    expect(db.read('users/user_b')).toMatchObject({
      pushToken: 'other-b',
      pushTokens: ['other-b'],
    });
    expect(db.entries('deviceTokens/').map(([, value]) => value)).toEqual([
      expect.objectContaining({ token: null, tokenHash, isActive: false }),
    ]);
  });
});
