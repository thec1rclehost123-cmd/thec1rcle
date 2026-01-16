/**
 * THE C1RCLE - Event Data Repair & Migration Script
 * Standardizes lifecycle, cityKey, and media fields for all existing events.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "apps/guest-portal/.env.local") });

const { getAdminDb, isFirebaseConfigured } = require("./apps/partner-dashboard/lib/firebase/admin");
const { EVENT_LIFECYCLE, normalizeCity, getCityLabel, resolvePoster, CITY_MAP } = require("@c1rcle/core/events");

async function repairEvents() {
    if (!isFirebaseConfigured()) {
        console.error("Firebase not configured. migration cannot run.");
        process.exit(1);
    }

    const db = getAdminDb();
    const snapshot = await db.collection("events").get();
    console.log(`Analyzing ${snapshot.size} events...`);

    let updatedCount = 0;
    const batch = db.batch();

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        let needsUpdate = false;
        const updates = {};

        // 1. Lifecycle Repair
        if (!data.lifecycle) {
            // Infer lifecycle from status or date
            if (data.status === "past") {
                updates.lifecycle = EVENT_LIFECYCLE.COMPLETED;
            } else if (data.status === "live") {
                updates.lifecycle = EVENT_LIFECYCLE.LIVE;
            } else {
                updates.lifecycle = EVENT_LIFECYCLE.SCHEDULED; // Assume scheduled if active
            }
            needsUpdate = true;
            console.log(`[Lifecycle] ${doc.id}: ${data.lifecycle || 'none'} -> ${updates.lifecycle}`);
        }

        // 2. CityKey & Label Repair
        const isValidKey = data.cityKey && CITY_MAP.some(c => c.key === data.cityKey);
        const currentCityKey = isValidKey ? data.cityKey : normalizeCity(data.city, data.location);
        const canonicalLabel = getCityLabel(currentCityKey);

        if (data.cityKey !== currentCityKey) {
            updates.cityKey = currentCityKey;
            needsUpdate = true;
        }

        if (data.city !== canonicalLabel) {
            updates.city = canonicalLabel;
            needsUpdate = true;
            console.log(`[CityLabel] ${doc.id}: ${data.city} -> ${canonicalLabel}`);
        }

        // 3. Media Repair
        const canonicalPoster = resolvePoster(data);
        if (data.image !== canonicalPoster || !data.poster) {
            updates.image = canonicalPoster;
            updates.poster = canonicalPoster;
            needsUpdate = true;
            console.log(`[Media] ${doc.id}: image inconsistency fixed`);
        }

        // 4. Keyword Repair (for search)
        if (!data.keywords || data.keywords.length === 0) {
            const searchString = `${data.title} ${data.category} ${data.host} ${data.location} ${updates.cityKey || data.cityKey}`.toLowerCase();
            updates.keywords = Array.from(new Set(searchString.split(/[\s,]+/).filter(k => k.length > 2)));
            needsUpdate = true;
        }

        if (needsUpdate) {
            updates.updatedAt = new Date().toISOString();
            batch.update(doc.ref, updates);
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        console.log(`Committing ${updatedCount} updates...`);
        await batch.commit();
        console.log("Migration complete.");
    } else {
        console.log("No repair needed.");
    }
}

repairEvents().catch(console.error);
