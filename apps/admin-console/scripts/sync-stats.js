const { adminStore } = require('../lib/server/adminStore');

/**
 * Sync script to precompute platform statistics.
 * Enhanced with retry logic for transient failures.
 */
async function sync(attempt = 1) {
  console.log(`--- Platform Stats Sync started (Attempt ${attempt}) ---`);
  try {
    const stats = await adminStore.computePlatformStats();
    console.log('Successfully synced:', stats);
    process.exit(0);
  } catch (error) {
    console.error(`Sync attempt ${attempt} failed:`, error.message);

    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Retrying in ${delay / 1000}s...`);
      setTimeout(() => sync(attempt + 1), delay);
    } else {
      console.error('Max retries reached. Sync failed.');
      process.exit(1);
    }
  }
}

sync();
