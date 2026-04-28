const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "apps/partner-dashboard/.env.local") });

const { getAdminDb, isFirebaseConfigured } = require("./apps/partner-dashboard/lib/firebase/admin");

async function checkEvents() {
    if (!isFirebaseConfigured()) {
        console.log("Firebase not configured");
        return;
    }
    const db = getAdminDb();
    const snapshot = await db.collection("events").get();
    console.log(`Total events: ${snapshot.size}`);
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}, Title: ${data.title}, Lifecycle: ${data.lifecycle}, city: ${data.city}, cityKey: ${data.cityKey}, VenueId: ${data.venueId}`);
    });
}

checkEvents().catch(console.error);
