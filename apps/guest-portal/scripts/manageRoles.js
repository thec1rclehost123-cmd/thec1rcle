import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { getAdminAuth } from '@c1rcle/core/admin';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');

// Load .env.local
config({ path: resolve(__dirname, '../.env.local') });

const auth = getAdminAuth();

const setRole = async (email, role) => {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(user.uid, { role });
    console.log(`Successfully set role '${role}' for user: ${email} (${user.uid})`);

    // Force token refresh on next sign-in or by calling user.getIdToken(true) on client
    console.log('User must re-sign or refresh their token to see the changes.');
  } catch (error) {
    console.error('Error setting role:', error.message);
  }
};

const args = process.argv.slice(2);
const [email, role] = args;

if (!email || !role) {
  console.log('Usage: node scripts/manageRoles.js <email> <role>');
  console.log('Available roles: admin, club, host, promoter, user, staff');
  process.exit(0);
}

setRole(email, role);
