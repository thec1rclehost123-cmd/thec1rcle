/**
 * Firestore Read Instrumentation (Admin SDK)
 *
 * Wraps Firebase Admin SDK ref.get() calls to count and log reads per
 * server request. Works with both DocumentReference.get() and Query.get().
 *
 * AsyncLocalStorage isolates per-request counters across concurrent renders.
 *
 * Usage:
 *   import { trackedGet, logReadSummary } from "./firestoreMetrics";
 *   const snap = await trackedGet(db.collection("events").doc(id), "eventStore.getEvent");
 *   logReadSummary("/event/[id]");
 *
 * Read count targets:
 *   Browse pages (/, /explore, /hosts):   ≤ 3 reads
 *   Detail pages (/event/[id]):           ≤ 5 reads
 *   Authenticated paths (/profile):       ≤ 5 reads
 */

import { AsyncLocalStorage } from "async_hooks";

const storage = new AsyncLocalStorage();

/** Run a server component tree with an isolated read counter. */
export function runWithReadCounter(fn) {
  return storage.run({ count: 0, labels: [] }, fn);
}

function getStore() {
  return storage.getStore();
}

/**
 * Wraps any Firebase Admin SDK ref.get() call (DocumentReference or Query).
 * Increments the per-request read counter and logs in development.
 */
export async function trackedGet(ref, label = "unknown") {
  const store = getStore();
  if (store) {
    store.count++;
    store.labels.push(label);
    if (process.env.NODE_ENV === "development") {
      console.log(`[Firestore Read #${store.count}] get — ${label}`);
    }
  }
  return ref.get();
}

/**
 * Log a summary of all Firestore reads in the current request.
 * Call this at the end of a server component or API route handler.
 */
export function logReadSummary(page = "unknown") {
  const store = getStore();
  if (!store) return;
  const { count, labels } = store;

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[Firestore Summary] page="${page}" reads=${count} ops=[${labels.join(", ")}]`
    );
  } else {
    // Structured JSON for production log aggregation (Datadog, CloudWatch)
    console.log(
      JSON.stringify({ type: "firestore_reads", page, reads: count, ops: labels })
    );
  }
}
