import { getOperatingCalendar } from './packages/core/calendar-engine.js';
import * as admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

admin.initializeApp({
    projectId: 'demo-c1rcle'
});

async function run() {
    try {
        console.log("Checking venue calendar for ID: venue-1...");
        const result = await getOperatingCalendar(admin.firestore(), 'venue-1', 'venue', '2020-01-01', '2025-12-31');
        console.log("Result:", result);
    } catch (e) {
        console.error(e);
    }
}
run();
