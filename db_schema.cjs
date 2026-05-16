/**
 * DB Schema Inspector — lists all collections and their field schemas.
 *
 * Usage:
 *   node db_schema.cjs
 *
 * Requires Firebase Admin env vars:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

const admin = require("firebase-admin");

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (!projectId || !clientEmail || !privateKey) {
    console.log("\n❌ Firebase Admin credentials not found.\n");
    process.exit(1);
}
if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
privateKey = privateKey.replace(/\\n/g, "\n");

admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
const db = admin.firestore();

function inferType(val) {
    if (val === null || val === undefined) return "null";
    if (typeof val === "boolean") return "boolean";
    if (typeof val === "number") return "number";
    if (typeof val === "string") return "string";
    if (typeof val === "object" && Array.isArray(val)) {
        if (val.length === 0) return "array[]";
        const types = [...new Set(val.map(v => typeof v === "object" && v !== null ? (Array.isArray(v) ? "array" : "object") : typeof v))];
        return `array<${types.join("|")}>`;
    }
    if (val instanceof admin.firestore.Timestamp) return "Timestamp";
    if (val instanceof admin.firestore.GeoPoint) return "GeoPoint";
    if (val instanceof admin.firestore.DocumentReference) return "DocumentReference";
    if (typeof val === "object") return "object";
    return typeof val;
}

async function inspectCollection(name, sampleSize = 5) {
    const snap = await db.collection(name).limit(sampleSize).get();
    if (snap.empty) return { docCount: 0, fields: {} };

    // Get total count
    const countSnap = await db.collection(name).limit(1000).get();
    const totalDocs = countSnap.size;

    const fieldMap = {};
    for (const doc of snap.docs) {
        const data = doc.data();
        for (const [key, val] of Object.entries(data)) {
            if (!fieldMap[key]) {
                fieldMap[key] = { types: new Set(), count: 0, sample: val };
            }
            fieldMap[key].types.add(inferType(val));
            fieldMap[key].count++;
        }
    }
    return { docCount: totalDocs, fields: fieldMap };
}

async function listCollections() {
    // Firestore doesn't have a listCollections API in the Admin SDK v10 directly.
    // We query known collection names by reading from system metadata.
    // Alternatively, we let the user specify or discover via parent docs.
    // Known collections from the codebase:
    const known = [
        "admin_audit_config", "admin_audit_logs", "admins",
        "audit_logs",
        "cart_reservations", "chats", "couple_claims",
        "dating_profiles", "dinein_entries", "door_sales",
        "entitlements", "event_card_index", "event_queues",
        "event_surge_metrics", "events",
        "follows",
        "health_checks", "homepage_interviews", "homepage_selects",
        "host_applications", "host_audit_log", "host_settings",
        "host_summary", "hosts",
        "identities",
        "ledger_entries",
        "memberships",
        "notifications",
        "onboarding_requests", "orders", "otp_completions", "otps",
        "partner_finance_aggregates", "partner_memberships",
        "partners", "partnerships", "platform_settings", "platform_stats",
        "profile_highlights", "promo_codes", "promo_redemptions",
        "promoter_connections", "promoter_links", "promoter_preferences",
        "promoters", "purchased_tickets",
        "reservations", "rsvp_orders",
        "scan_ledger", "share_bundles", "slot_requests",
        "staff_profile_audit", "system_counters", "system_events",
        "ticket_scans",
        "users",
        "venue_calendar", "venue_facilities", "venue_registers",
        "venue_staff", "venue_summary", "venues",
    ];

    // Also discover any collections that may exist
    const allCollections = new Set(known);
    try {
        // Try to discover from a system doc
        const sysSnap = await db.collection("system_meta").limit(1).get();
        if (!sysSnap.empty) allCollections.add("system_meta");
    } catch {}

    console.log(`\n${"=".repeat(90)}`);
    console.log("  FIRESTORE DATABASE SCHEMA INSPECTOR");
    console.log(`  Project: ${projectId}`);
    console.log(`${"=".repeat(90)}\n`);

    let totalDocs = 0;

    for (const name of [...allCollections].sort()) {
        try {
            const { docCount, fields } = await inspectCollection(name);
            if (docCount === 0) {
                console.log(`  ⏭️  ${name}  —  empty (0 docs)`);
                console.log();
                continue;
            }
            totalDocs += docCount;
            console.log(`  📁 ${name}  —  ${docCount} document${docCount !== 1 ? "s" : ""}`);
            console.log(`  ${"-".repeat(80)}`);

            const sortedFields = Object.entries(fields).sort((a, b) => b[1].count - a[1].count);
            for (const [field, info] of sortedFields) {
                const types = [...info.types].join(" | ");
                const presence = `${info.count}/${Math.min(docCount, 5)} docs`;
                const sample = info.sample !== undefined ? `  e.g. ${JSON.stringify(info.sample).slice(0, 60)}` : "";
                console.log(`     ${field.padEnd(30)} ${types.padEnd(20)} ${presence.padEnd(15)} ${sample}`);
            }
            console.log();
        } catch (e) {
            console.log(`  ❌ ${name}  —  Error: ${e.message}`);
            console.log();
        }
    }

    console.log(`${"=".repeat(90)}`);
    console.log(`  Total: ${totalDocs} documents across inspected collections`);
    console.log(`${"=".repeat(90)}\n`);
    process.exit(0);
}

listCollections().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
