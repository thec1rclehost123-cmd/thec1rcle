import { getAdminAuth, getAdminDb } from '@c1rcle/core/admin';
import {
  addToOnboardingMigrationReport,
  createOnboardingMigrationReport,
  planOnboardingV2Migration,
} from '@c1rcle/core/onboarding-migration';

const apply = process.argv.includes('--apply');
const db = getAdminDb();
const auth = getAdminAuth();

type FirestoreUserDocument = {
  id: string;
  data(): Record<string, unknown>;
  ref: {
    set(data: Record<string, unknown>, options: { merge: boolean }): Promise<unknown>;
  };
};

async function main() {
  const report = createOnboardingMigrationReport();
  const snapshot = await db.collection('users').get();
  const documents = snapshot.docs as FirestoreUserDocument[];
  const firestoreUsers = new Map<string, FirestoreUserDocument>(
    documents.map((document) => [document.id, document]),
  );
  let pageToken: string | undefined;

  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const authRecord of page.users) {
      const document = firestoreUsers.get(authRecord.uid);
      const data = document?.data() || {};
      const plan = planOnboardingV2Migration(authRecord.uid, data, authRecord);
      addToOnboardingMigrationReport(report, plan, true, Boolean(document));
      if (apply && plan.changed) {
        await db.collection('users').doc(authRecord.uid).set(plan.patch, { merge: true });
      }
      firestoreUsers.delete(authRecord.uid);
    }
    pageToken = page.pageToken;
  } while (pageToken);

  // Orphaned Firestore documents are reported separately. They are never
  // treated as verified users because no Firebase identity exists.
  for (const document of firestoreUsers.values()) {
    const plan = planOnboardingV2Migration(document.id, document.data(), null);
    addToOnboardingMigrationReport(report, plan, false, true);
    if (apply && plan.changed && plan.patch) {
      await document.ref.set(plan.patch, { merge: true });
    }
  }

  console.info(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        migrationVersion: 2,
        ...report,
      },
      null,
      2,
    ),
  );
  if (!apply) console.info('Dry-run only. Review this report before rerunning with --apply.');
}

main().catch((error) => {
  console.error('[migrate-onboarding-v2] failed', error);
  process.exitCode = 1;
});
