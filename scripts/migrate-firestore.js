/**
 * THE C1RCLE - Firestore Venue Terminology Migration Script
 * Migrates legacy 'club' terminology to 'venue'.
 * 
 * Usage: 
 * 1. Ensure env vars are set (FIREBASE_PROJECT_ID, etc.)
 * 2. Run: node scripts/migrate-firestore.js
 */

import { initializeApp, cert, getApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../apps/partner-dashboard/.env.local") });

async function migrate() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!projectId || !clientEmail || !privateKey) {
        console.error("Missing Firebase credentials in apps/partner-dashboard/.env.local");
        process.exit(1);
    }

    if (!getApps().length) {
        initializeApp({
            credential: cert({ projectId, clientEmail, privateKey })
        });
    }

    const db = getFirestore();
    const log = [];

    console.log("Starting migration...");

    // 1. Collections to move (Copy and Delete)
    const collectionsToMove = [
        { from: "club_calendar", to: "venue_calendar" },
        { from: "club_registers", to: "venue_registers" },
        { from: "club_staff", to: "venue_staff" },
        { from: "club_tables", to: "venue_tables" }
    ];

    for (const coll of collectionsToMove) {
        const snap = await db.collection(coll.from).get();
        if (snap.empty) {
            console.log(`Collection ${coll.from} is empty or missing. Skipping.`);
            continue;
        }

        console.log(`Migrating ${snap.size} documents from ${coll.from} to ${coll.to}...`);
        for (const doc of snap.docs) {
            const data = doc.data();

            // Normalize internal fields
            if (data.clubId) {
                data.venueId = data.clubId;
                delete data.clubId;
            }
            if (data.blockedBy?.role === 'club') {
                data.blockedBy.role = 'venue';
            }

            await db.collection(coll.to).doc(doc.id).set(data);
            await db.collection(coll.from).doc(doc.id).delete();
            console.log(`  Moved ${doc.id}`);
        }
    }

    // 2. Collections to update fields in place
    const collectionsToUpdate = [
        {
            name: "partner_memberships",
            conditions: [{ field: "partnerType", op: "==", value: "club" }],
            updates: { partnerType: "venue" }
        },
        {
            name: "events",
            conditions: [{ field: "creatorRole", op: "==", value: "club" }],
            updates: { creatorRole: "venue" }
        }
    ];

    for (const coll of collectionsToUpdate) {
        let query = db.collection(coll.name);
        for (const cond of coll.conditions) {
            query = query.where(cond.field, cond.op, cond.value);
        }

        const snap = await query.get();
        console.log(`Updating ${snap.size} documents in ${coll.name}...`);
        for (const doc of snap.docs) {
            await doc.ref.update(coll.updates);
            console.log(`  Updated ${doc.id}`);
        }
    }

    // 3. Special handling for Partnerships (renaming fields)
    const partnershipsSnap = await db.collection("partnerships").get();
    console.log(`Auditing ${partnershipsSnap.size} partnerships...`);
    for (const doc of partnershipsSnap.docs) {
        const data = doc.data();
        const updates = {};
        if (data.clubId) {
            updates.venueId = data.clubId;
            updates.clubId = FieldValue.delete();
        }
        if (data.clubName) {
            updates.venueName = data.clubName;
            updates.clubName = FieldValue.delete();
        }

        if (Object.keys(updates).length > 0) {
            await doc.ref.update(updates);
            console.log(`  Migrated partnership fields: ${doc.id}`);
        }
    }

    // 4. Update Audit Trails in Events
    const eventsSnap = await db.collection("events").get();
    console.log(`Auditing audit trails for ${eventsSnap.size} events...`);
    for (const doc of eventsSnap.docs) {
        const data = doc.data();
        if (Array.isArray(data.auditTrail)) {
            let changed = false;
            const newTrail = data.auditTrail.map(entry => {
                if (entry.actor?.role === 'club') {
                    entry.actor.role = 'venue';
                    changed = true;
                }
                return entry;
            });

            if (changed) {
                await doc.ref.update({ auditTrail: newTrail });
                console.log(`  Updated audit trail for event: ${doc.id}`);
            }
        }
    }

    console.log("Migration completed successfully.");
}

migrate().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
