const { cert, initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');

const email = 'epitome@gmail.com';
const configs = {
  dev: { file: 'apps/api-gateway/.env.development', project: 'c1rcle-staging' },
  staging: { file: 'apps/api-gateway/.env.staging', project: 'c1rcle-staging' },
};

function extractCreds(filePath) {
  const env = fs.readFileSync(filePath, 'utf8');
  const pid = env.match(/FIREBASE_PROJECT_ID=(.+)/)?.[1]?.trim();
  const ce = env.match(/FIREBASE_CLIENT_EMAIL=(.+)/)?.[1]?.trim();
  const pkRaw = env.match(/FIREBASE_PRIVATE_KEY="([\s\S]*?)"/)?.[1];
  if (!pid || !ce || !pkRaw) return null;
  return { projectId: pid, clientEmail: ce, privateKey: pkRaw.replace(/\\n/g, '\n') };
}

async function main() {
  for (const [name, cfg] of Object.entries(configs)) {
    const creds = extractCreds(cfg.file);
    if (!creds) {
      console.log(`${name}: could not parse creds`);
      continue;
    }
    try {
      const app = initializeApp({ credential: cert(creds) }, name);
      const user = await getAuth(app).getUserByEmail(email);
      console.log(`${name} (${creds.projectId}): USER EXISTS — uid=${user.uid}`);
    } catch (e) {
      console.log(
        `${name} (${creds.projectId}): ${e.code === 'auth/user-not-found' ? 'USER NOT FOUND' : 'ERROR: ' + e.message.substring(0, 80)}`,
      );
    }
  }
}
main();
