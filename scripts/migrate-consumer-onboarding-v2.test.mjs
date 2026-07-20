import { describe, expect, it } from 'vitest';

import {
  assertApplyGuard,
  parseOnboardingMigrationArgs,
  runOnboardingMigration,
} from './migrate-consumer-onboarding-v2.mjs';

describe('consumer onboarding v2 migration CLI safety', () => {
  it('defaults to dry-run with bounded pagination', () => {
    const options = parseOnboardingMigrationArgs([]);
    expect(options).toMatchObject({ apply: false, pageSize: 100, resumeAfter: '' });
    expect(() => assertApplyGuard(options, 'thec1rcle-prod')).not.toThrow();
  });

  it('supports pagination, resume, max-document, and report arguments', () => {
    expect(
      parseOnboardingMigrationArgs([
        '--page-size',
        '250',
        '--resume-after=user_250',
        '--max-documents',
        '500',
        '--report',
        './migration.jsonl',
      ]),
    ).toMatchObject({
      pageSize: 250,
      resumeAfter: 'user_250',
      maxDocuments: 500,
      report: './migration.jsonl',
    });
  });

  it('rejects apply unless confirmation and project guards both match', () => {
    const missingGuards = parseOnboardingMigrationArgs(['--apply']);
    expect(() => assertApplyGuard(missingGuards, 'thec1rcle-prod')).toThrow(/--confirm/);

    const wrongProject = parseOnboardingMigrationArgs([
      '--apply',
      '--confirm',
      'APPLY_CONSUMER_ONBOARDING_V2',
      '--project',
      'wrong-project',
    ]);
    expect(() => assertApplyGuard(wrongProject, 'thec1rcle-prod')).toThrow(/--project/);

    const guarded = parseOnboardingMigrationArgs([
      '--apply',
      '--confirm',
      'APPLY_CONSUMER_ONBOARDING_V2',
      '--project',
      'thec1rcle-prod',
    ]);
    expect(() => assertApplyGuard(guarded, 'thec1rcle-prod')).not.toThrow();
  });

  it('paginates from an exclusive resume cursor without writing in dry-run mode', async () => {
    const rows = ['user_0', 'user_1', 'user_2', 'user_3', 'user_4'].map((id) => ({
      id,
      data: () => ({ displayName: id }),
      ref: { id },
    }));
    const starts = [];
    const db = {
      collection: () => ({
        orderBy: () => {
          let after = '';
          let take = 100;
          const query = {
            limit(value) {
              take = value;
              return query;
            },
            startAfter(value) {
              after = value;
              starts.push(value);
              return query;
            },
            async get() {
              const docs = rows.filter((row) => row.id > after).slice(0, take);
              return { empty: docs.length === 0, docs };
            },
          };
          return query;
        },
      }),
    };
    const auth = {
      getUser: async (uid) => ({
        uid,
        email: `${uid}@example.com`,
        emailVerified: true,
        providerData: [{ providerId: 'google.com' }],
      }),
    };
    const records = [];
    const options = parseOnboardingMigrationArgs([
      '--page-size',
      '2',
      '--resume-after',
      'user_0',
      '--max-documents',
      '3',
    ]);

    const summary = await runOnboardingMigration({
      db,
      auth,
      options,
      projectId: 'test-project',
      report: async (record) => records.push(record),
    });

    expect(summary.scanned).toBe(3);
    expect(summary.lastProcessedId).toBe('user_3');
    expect(summary.applied).toBe(0);
    expect(starts).toEqual(['user_0', 'user_2']);
    expect(
      records.filter((record) => record.type === 'user').map((record) => record.userId),
    ).toEqual(['user_1', 'user_2', 'user_3']);
  });
});
