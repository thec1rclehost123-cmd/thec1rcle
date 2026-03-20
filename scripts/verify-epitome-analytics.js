import { config } from "dotenv";
import { resolve } from "node:path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Load .env
config({ path: resolve(process.cwd(), ".env") });

const projectId = process.env.FIREBASE_PROJECT_ID || "c1rcle-staging";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
    let body = privateKey.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "");
    body = body.replace(/[^a-zA-Z0-9+/=]/g, "");
    const formattedBody = body.match(/.{1,64}/g)?.join("\n");
    if (formattedBody) privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedBody}\n-----END PRIVATE KEY-----\n`;
}

initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });

// Import the analytics store functions
// Note: We need to point to the correct path in the apps/partner-dashboard
import {
    getVenueAnalytics,
    getVenueAudienceAnalytics,
    getVenueRevenueAnalytics,
    getVenueOpsAnalytics,
    getVenueStrategyAnalytics
} from "../apps/partner-dashboard/lib/server/analyticsStore.js";

const VENUE_ID = "venue_NPpsWyAw";

async function verify() {
    console.log(`\n📊 FETCHING ANALYTICS FOR EPITOME (${VENUE_ID})...\n`);

    const overview = await getVenueAnalytics(VENUE_ID);
    const audience = await getVenueAudienceAnalytics(VENUE_ID);
    const revenue = await getVenueRevenueAnalytics(VENUE_ID);
    const ops = await getVenueOpsAnalytics(VENUE_ID);
    const strategy = await getVenueStrategyAnalytics(VENUE_ID);

    console.log("✅ OVERVIEW:");
    console.log(`   - Total Revenue: ₹${overview.totalRevenue.toLocaleString()}`);
    console.log(`   - Tickets Sold: ${overview.totalTicketsSold}`);
    console.log(`   - Total Check-ins: ${overview.totalCheckIns}`);
    console.log(`   - Avg Turnout: ${overview.avgTurnout}%`);

    console.log("\n✅ AUDIENCE DEMOGRAPHICS:");
    console.log(`   - Gender Ratio: Male ${Math.round(audience.genderRatio.male)} : Female ${Math.round(audience.genderRatio.female)}`);
    console.log(`   - Age Bands: ${JSON.stringify(audience.ageBands)}`);
    console.log(`   - Top Locations: ${audience.topLocations.map(l => l.city).join(", ")}`);

    console.log("\n✅ OPERATIONS:");
    console.log(`   - Peak Entry Hour: ${ops.peakEntryHour}:00 IST`);
    console.log(`   - Total Scans: ${ops.entryCurve.reduce((s, c) => s + c.count, 0)}`);

    console.log("\n✅ AI STRATEGY RECOMMENDATIONS:");
    strategy.recommendations.forEach(r => {
        console.log(`   - [${r.impact} Impact] ${r.title}: ${r.desc}`);
    });

    process.exit(0);
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
