import { getAdminDb } from "./apps/partner-dashboard/lib/server/firebase/admin.js";

async function checkEvents() {
    const db = getAdminDb();
    const snapshot = await db.collection("events").where("lifecycle", "==", "approved").limit(5).get();
    
    if (snapshot.empty) {
        console.log("No approved events found.");
        return;
    }

    snapshot.forEach(doc => {
        console.log("Event ID:", doc.id);
        console.log("Data snippet:", {
            title: doc.data().title,
            lifecycle: doc.data().lifecycle,
            hostId: doc.data().hostId,
            venueId: doc.data().venueId,
            startDate: doc.data().startDate,
            poster: doc.data().poster
        });
    });
}

checkEvents().catch(console.error);
