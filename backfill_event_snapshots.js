/**
 * Backfill hostData and venueData snapshots into existing event documents.
 *
 * Events created before the FirebaseEventRepository.embedHostVenueData() change
 * are missing embedded host/venue snapshots. Without them, the event detail page
 * falls back to 3 separate Firestore reads (event + host + venue) instead of 1.
 *
 * This script:
 *   1. Reads all events from Firestore
 *   2. Skips events that already have both hostData and venueData
 *   3. Resolves missing host/venue data (with in-process caching to avoid duplicate reads)
 *   4. Writes the patches back in batched updates (400 per batch)
 *
 * Usage:
 *   node backfill_event_snapshots.js            # dry run -- logs what would change, no writes
 *   node backfill_event_snapshots.js --write    # commit updates to Firestore
 */

import { getAdminDb } from "@c1rcle/core/admin";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "apps/guest-portal/.env.development") });

const DRY_RUN = !process.argv.includes("--write");
const BATCH_SIZE = 400; // Firestore hard limit is 500; stay under for safety

// Cache keyed by "id:<id>" or "handle:@handle" -- avoids re-fetching
// the same host/venue for events that share a host or venue.
const hostCache = new Map();
const venueCache = new Map();

async function resolveHost(db, hostId, hostHandle) {
    const cacheKey = hostId ? `id:${hostId}` : `handle:${hostHandle}`;
    if (hostCache.has(cacheKey)) return hostCache.get(cacheKey);

    try {
        let snap = null;

        if (hostId) {
            snap = await db.collection("hosts").doc(hostId).get();
        }

        if ((!snap || !snap.exists) && hostHandle) {
            const normalized = hostHandle.startsWith("@") ? hostHandle : `@${hostHandle}`;
            const q = await db.collection("hosts").where("handle", "==", normalized).limit(1).get();
            if (!q.empty) snap = q.docs[0];
        }

        if (!snap || !snap.exists) {
            hostCache.set(cacheKey, null);
            return null;
        }

        const d = snap.data();
        const result = {
            id: snap.id,
            handle: d.handle || hostHandle || "",
            name: d.name || d.displayName || "",
            avatar: d.avatar || d.photoURL || "",
            slug: d.slug || snap.id,
            type: "host",
        };
        hostCache.set(cacheKey, result);
        return result;
    } catch (err) {
        console.error(`    [ERR] resolveHost(${cacheKey}): ${err.message}`);
        return null;
    }
}

async function resolveVenue(db, venueId, venueName) {
    const cacheKey = venueId ? `id:${venueId}` : `name:${venueName}`;
    if (venueCache.has(cacheKey)) return venueCache.get(cacheKey);

    try {
        let snap = null;

        if (venueId) {
            snap = await db.collection("venues").doc(venueId).get();
        }

        if ((!snap || !snap.exists) && venueName) {
            const slug = venueName.toLowerCase().replace(/\s+/g, "-");
            const q = await db.collection("venues").where("slug", "==", slug).limit(1).get();
            if (!q.empty) snap = q.docs[0];
        }

        if (!snap || !snap.exists) {
            venueCache.set(cacheKey, null);
            return null;
        }

        const d = snap.data();
        const result = {
            id: snap.id,
            name: d.name || venueName || "",
            slug: d.slug || snap.id,
            photoURL: d.photoURL || d.image || "",
            image: d.image || d.photoURL || "",
            area: d.area || "",
            type: "venue",
        };
        venueCache.set(cacheKey, result);
        return result;
    } catch (err) {
        console.error(`    [ERR] resolveVenue(${cacheKey}): ${err.message}`);
        return null;
    }
}

async function backfill() {
    const db = getAdminDb();
    if (!db) {
        console.error("Firebase Admin not configured. Check apps/guest-portal/.env.development");
        process.exit(1);
    }

    console.log(`Connected to Firebase project: ${process.env.FIREBASE_PROJECT_ID}`);
    console.log(`Mode: ${DRY_RUN ? "DRY RUN (pass --write to commit changes)" : "WRITE"}`);
    console.log("-".repeat(60));
    console.log("Fetching all events...");

    const snapshot = await db.collection("events").get();
    console.log(`Found ${snapshot.size} events.\n`);

    let alreadyEnriched = 0;
    let noIdentifiers = 0;
    let enrichedCount = 0;
    let unresolvable = 0;

    const updates = []; // { ref, patch }

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Skip events that are already fully denormalized
        if (data.hostData && data.venueData) {
            alreadyEnriched++;
            continue;
        }

        const hostId = data.hostId;
        const hostHandle = data.host;
        const venueId = data.venueId;
        const venueName = data.venue;

        const needsHost = !data.hostData && (hostId || hostHandle);
        const needsVenue = !data.venueData && (venueId || venueName);

        if (!needsHost && !needsVenue) {
            noIdentifiers++;
            continue;
        }

        const patch = {};

        if (needsHost) {
            const hostData = await resolveHost(db, hostId, hostHandle);
            if (hostData) {
                patch.hostData = hostData;
            } else {
                console.log(`  [WARN] ${doc.id} -- host not resolved (hostId=${hostId ?? "-"}, handle=${hostHandle ?? "-"})`);
            }
        }

        if (needsVenue) {
            const venueData = await resolveVenue(db, venueId, venueName);
            if (venueData) {
                patch.venueData = venueData;
            } else {
                console.log(`  [WARN] ${doc.id} -- venue not resolved (venueId=${venueId ?? "-"}, name=${venueName ?? "-"})`);
            }
        }

        if (Object.keys(patch).length > 0) {
            patch.updatedAt = new Date().toISOString();
            updates.push({ ref: doc.ref, patch });
            enrichedCount++;
            const fields = Object.keys(patch).filter(k => k !== "updatedAt").join(", ");
            console.log(`  [ENRICH] ${doc.id} -- ${fields}`);
        } else {
            unresolvable++;
        }
    }

    console.log("\n" + "-".repeat(60));
    console.log("Summary:");
    console.log(`  Already fully enriched (skipped) : ${alreadyEnriched}`);
    console.log(`  No host/venue identifiers        : ${noIdentifiers}`);
    console.log(`  Host/venue not found in DB       : ${unresolvable}`);
    console.log(`  To be enriched                   : ${enrichedCount}`);
    console.log(`  Unique hosts resolved            : ${[...hostCache.values()].filter(Boolean).length} (${hostCache.size} looked up)`);
    console.log(`  Unique venues resolved           : ${[...venueCache.values()].filter(Boolean).length} (${venueCache.size} looked up)`);

    if (DRY_RUN) {
        console.log("\nDry run complete. No writes made.");
        console.log("Re-run with --write to commit.\n");
        return;
    }

    if (updates.length === 0) {
        console.log("\nNothing to write.\n");
        return;
    }

    console.log(`\nCommitting ${updates.length} updates in batches of ${BATCH_SIZE}...`);

    const totalBatches = Math.ceil(updates.length / BATCH_SIZE);
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const chunk = updates.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        for (const { ref, patch } of chunk) {
            batch.update(ref, patch);
        }
        await batch.commit();
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        console.log(`  Batch ${batchNum}/${totalBatches} committed (${chunk.length} docs)`);
    }

    console.log("\nBackfill complete.\n");
}

backfill().catch(err => {
    console.error("Backfill failed:", err);
    process.exit(1);
});
