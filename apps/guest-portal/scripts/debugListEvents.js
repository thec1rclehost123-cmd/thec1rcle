require('dotenv').config({ path: '.env.local' });

// We need to use Babel or Ts-node if the files use ESM.
// But the project seems to be using ESM in files.
// Let's try to use dynamic import in a script.

async function testListEvents() {
    // Note: This matches the ESM structure
    const { listEvents } = await import('../lib/server/eventStore.js');
    console.log('--- Testing listEvents ---');
    const events = await listEvents({ limit: 60 });
    console.log('--- Finished ---');
    console.log(`Final count: ${events.length}`);
}

testListEvents().catch(console.error);
