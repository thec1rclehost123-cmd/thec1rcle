import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "./client";
import { events as fallbackEvents } from "../../data/events";

const mapSnapshot = (snapshot) => {
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() };
};

export const fetchEventsByIds = async (ids = []) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  try {
    const db = getFirebaseDb();
    const snapshots = await Promise.all(ids.map((id) => getDoc(doc(db, "events", id))));

    const fetchedEvents = snapshots.map((snap) => {
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() };
      }
      // Fallback to local data if not found in Firestore
      return fallbackEvents.find(e => e.id === snap.id) || null;
    }).filter(Boolean);

    return fetchedEvents;
  } catch (error) {
    console.error("fetchEventsByIds fallback", error);
    return fallbackEvents.filter((event) => ids.includes(event.id));
  }
};

export default fetchEventsByIds;
