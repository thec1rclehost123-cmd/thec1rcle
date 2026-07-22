import process from 'node:process';
import { appendFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { FieldPath } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb, isFirebaseConfigured } from '@c1rcle/core/admin';
import {
  buildOnboardingV2ApplyPatch,
  classifyOnboardingV2Migration,
  onboardingMigrationCohorts,
} from '@c1rcle/core/onboarding-migration';

const APPLY_CONFIRMATION = 'APPLY_CONSUMER_ONBOARDING_V2';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 400;

[
  resolve(REPO_ROOT, '.env'),
  resolve(REPO_ROOT, 'apps/api-gateway/.env.local'),
  resolve(REPO_ROOT, 'apps/api-gateway/.env.development'),
  resolve(REPO_ROOT, 'apps/api-gateway/.env.production'),
].forEach((envPath) => {
  if (existsSync(envPath)) loadEnv({ path: envPath, override: false });
});

export function parseOnboardingMigrationArgs(argv) {
  const options = {
    apply: false,
    confirm: '',
    project: '',
    pageSize: DEFAULT_PAGE_SIZE,
    maxDocuments: null,
    resumeAfter: '',
    report: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [inlineKey, inlineValue] = arg.split('=', 2);
    if (arg === '--apply') {
      options.apply = true;
    } else if (inlineKey === '--confirm' || arg === '--confirm') {
      options.confirm = inlineValue || String(argv[++index] || '');
    } else if (inlineKey === '--project' || arg === '--project') {
      options.project = inlineValue || String(argv[++index] || '');
    } else if (inlineKey === '--page-size' || arg === '--page-size') {
      options.pageSize = Number(inlineValue || argv[++index]);
    } else if (inlineKey === '--max-documents' || arg === '--max-documents') {
      options.maxDocuments = Number(inlineValue || argv[++index]);
    } else if (inlineKey === '--resume-after' || arg === '--resume-after') {
      options.resumeAfter = inlineValue || String(argv[++index] || '');
    } else if (inlineKey === '--report' || arg === '--report') {
      options.report = inlineValue || String(argv[++index] || '');
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (
    !Number.isInteger(options.pageSize) ||
    options.pageSize < 1 ||
    options.pageSize > MAX_PAGE_SIZE
  ) {
    throw new Error(`--page-size must be an integer from 1 to ${MAX_PAGE_SIZE}`);
  }
  if (
    options.maxDocuments !== null &&
    (!Number.isInteger(options.maxDocuments) || options.maxDocuments < 1)
  ) {
    throw new Error('--max-documents must be a positive integer');
  }
  return options;
}

export function assertApplyGuard(options, configuredProjectId) {
  if (!options.apply) return;
  if (options.confirm !== APPLY_CONFIRMATION) {
    throw new Error(`Apply mode requires --confirm ${APPLY_CONFIRMATION}`);
  }
  if (!options.project || options.project !== configuredProjectId) {
    throw new Error(
      `Apply mode requires --project ${configuredProjectId} to match FIREBASE_PROJECT_ID`,
    );
  }
}

function usage() {
  return [
    'Consumer onboarding v2 migration (dry-run by default)',
    '',
    'Dry-run:',
    '  node scripts/migrate-consumer-onboarding-v2.mjs --report ./onboarding-v2.jsonl',
    '',
    'Resume:',
    '  node scripts/migrate-consumer-onboarding-v2.mjs --resume-after USER_ID',
    '',
    'Apply (all three guards are mandatory):',
    `  node scripts/migrate-consumer-onboarding-v2.mjs --apply --confirm ${APPLY_CONFIRMATION} --project PROJECT_ID`,
  ].join('\n');
}

async function createReporter(reportPath) {
  if (!reportPath) return (record) => console.log(JSON.stringify(record));
  const absolutePath = resolve(process.cwd(), reportPath);
  await writeFile(absolutePath, '', 'utf8');
  return async (record) => {
    const line = JSON.stringify(record);
    console.log(line);
    await appendFile(absolutePath, `${line}\n`, 'utf8');
  };
}

async function getAuthRecord(auth, userId) {
  try {
    return await auth.getUser(userId);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return null;
    throw error;
  }
}

function emptySummary(mode, options, projectId) {
  return {
    type: 'summary',
    mode,
    projectId,
    resumeAfter: options.resumeAfter || null,
    lastProcessedId: null,
    scanned: 0,
    proposed: 0,
    applied: 0,
    unchanged: 0,
    authUsersMissing: 0,
    failures: 0,
    cohorts: Object.fromEntries(onboardingMigrationCohorts.map((cohort) => [cohort, 0])),
    stages: {},
  };
}

export async function runOnboardingMigration({ db, auth, options, projectId, report }) {
  const mode = options.apply ? 'apply' : 'dry-run';
  const summary = emptySummary(mode, options, projectId);
  let cursor = options.resumeAfter || null;
  let remaining = options.maxDocuments;

  while (remaining === null || remaining > 0) {
    const take = remaining === null ? options.pageSize : Math.min(options.pageSize, remaining);
    let query = db.collection('users').orderBy(FieldPath.documentId()).limit(take);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;

    const writes = [];
    for (const doc of snapshot.docs) {
      const data = doc.data() || {};
      try {
        const authRecord = await getAuthRecord(auth, doc.id);
        const classification = classifyOnboardingV2Migration({
          userId: doc.id,
          data,
          authRecord,
        });
        summary.scanned += 1;
        summary.lastProcessedId = doc.id;
        summary.cohorts[classification.cohort] = (summary.cohorts[classification.cohort] || 0) + 1;
        summary.stages[classification.currentStage] =
          (summary.stages[classification.currentStage] || 0) + 1;
        if (!authRecord) summary.authUsersMissing += 1;
        if (classification.shouldApply) summary.proposed += 1;
        else summary.unchanged += 1;

        await report({
          type: 'user',
          mode,
          userId: doc.id,
          cohort: classification.cohort,
          currentStage: classification.currentStage,
          firebasePhoneVerified: classification.firebasePhoneVerified,
          legacyComplete: classification.legacyComplete,
          proposedChanges: classification.proposedChanges,
        });

        if (options.apply && classification.shouldApply) {
          const migratedAt = new Date().toISOString();
          writes.push({
            ref: doc.ref,
            patch: buildOnboardingV2ApplyPatch(classification, data, migratedAt),
          });
        }
      } catch (error) {
        summary.failures += 1;
        await report({
          type: 'error',
          mode,
          userId: doc.id,
          code: error?.code || 'MIGRATION_CLASSIFICATION_FAILED',
          message: error?.message || String(error),
        });
      }
    }

    if (options.apply && writes.length) {
      const batch = db.batch();
      for (const write of writes) batch.set(write.ref, write.patch, { merge: true });
      await batch.commit();
      summary.applied += writes.length;
    }

    cursor = snapshot.docs.at(-1).id;
    if (remaining !== null) remaining -= snapshot.docs.length;
    if (snapshot.docs.length < take) break;
  }

  await report(summary);
  if (summary.failures > 0) {
    const error = new Error(`Migration completed with ${summary.failures} failed document(s)`);
    error.summary = summary;
    throw error;
  }
  return summary;
}

async function main() {
  const options = parseOnboardingMigrationArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || '';
  assertApplyGuard(options, projectId);
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase Admin credentials are not configured. No migration was attempted.');
  }

  const report = await createReporter(options.report);
  await runOnboardingMigration({
    db: getAdminDb(),
    auth: getAdminAuth(),
    options,
    projectId,
    report,
  });
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  main().catch((error) => {
    console.error('[migrate-consumer-onboarding-v2] failed:', error.message || error);
    process.exitCode = 1;
  });
}
