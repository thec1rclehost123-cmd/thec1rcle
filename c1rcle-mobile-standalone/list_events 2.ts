import { getFirebaseDb } from "./lib/firebase/index.ts";
import { collection, getDocs, limit, query } from "firebase/firestore";

async function list() {
  try {
    const db = getFirebaseDb();
    console.log("DB instance initialized");
    const q = query(collection(db, "events"), limit(1));
    const snap = await getDocs(q);
    if (snap.empty) {
      console.log("No events found");
    } else {
      console.log("Event found:", snap.docs[0].id);
      console.log("Data:", JSON.stringify(snap.docs[0].data(), null, 2));
    }
  } catch (e) {
    console.error("Error listing events:", e);
  }
}
list();
