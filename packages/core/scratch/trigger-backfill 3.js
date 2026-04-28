import { sendEvent, Events } from "../inngest-client.js";

async function runBackfill() {
    console.log("Triggering full public discovery backfill...");
    const result = await sendEvent(Events.PUBLIC_DISCOVERY_SYNC, { type: 'all' });
    if (result.success) {
        console.log("Success! Backfill event sent to Inngest.");
    } else {
        console.log("Failed to send backfill event:", result.error);
    }
}

runBackfill().catch(console.error);
