# Fix: Firestore Batch Write Limit in Recalculate Heat Scores Workflow

## 1) What was actual Bug
In [heat-sorting.js](file:///C:/Users/majid/thec1rcle/packages/core/workflows/heat-sorting.js) within the [recalculateHeatScores](file:///C:/Users/majid/thec1rcle/packages/core/workflows/heat-sorting.js#L11) Inngest function, the `update-heat-scores` step attempted to perform updates to all active events using a single Firestore write batch:

```javascript
const batch = db.batch();
// ...
for (const event of events) {
  // ...
  batch.update(db.collection('events').doc(event.id), { ... });
}
await batch.commit();
```

Google Cloud Firestore enforces a strict limit of **500 write operations** per single write batch commit (`db.batch()`). If there were more than 500 active events matching the query `lifecycle in ['scheduled', 'live']` and `isDeleted == false`, the number of added operations would exceed 500, causing `batch.commit()` to fail with a limit-exceeded exception. This completely aborted the Inngest step, preventing heat scores from being recalculated for any events.

## 2) What is solution to solve that Bug
The solution is to split the events list into chunks of at most 500 elements (the Firestore batch limit). For each chunk:
1. Initialize a new batch instance via `db.batch()`.
2. Add the updates for that chunk's events.
3. Commit the batch using `await batch.commit()`.

By chunking the updates, the code can handle an arbitrary number of active events without hitting the 500-operation Firestore limit.

## 3) What Changes You made to fix this Bug
Modified the `update-heat-scores` step in [heat-sorting.js](file:///C:/Users/majid/thec1rcle/packages/core/workflows/heat-sorting.js#L30-L60) to slice the `events` array into chunks of `500` (stored in the `batchLimit` constant) and execute individual batch operations for each chunk.

### Diff of Changes:
```diff
-    // Batch update heat scores
+    // Batch update heat scores in chunks of 500 to stay under Firestore's batch limits
     await step.run('update-heat-scores', async () => {
-      const batch = db.batch();
       const now = new Date();
-
-      for (const event of events) {
-        // Formula: (Tickets Sold * 10) + (Heat Signal * 5) - (Days to Event penalty)
-        // Simplified for Phase 2:
-        const ticketsSold = event.ticketsStats?.totalSold || 0;
-        const views = event.analytics?.views || 0;
-
-        // Base score
-        let score = ticketsSold * 10 + views * 0.5;
-
-        // Recency/Urgency: More heat if event is soon (but not past)
-        const eventStart = new Date(event.startDate);
-        const diffDays = (eventStart - now) / (1000 * 60 * 60 * 24);
-
-        if (diffDays > 0 && diffDays < 7) {
-          score += (7 - diffDays) * 20; // Up to 140 points for urgency
-        }
-
-        batch.update(db.collection('events').doc(event.id), {
-          heatScore: score,
-          heatScoreUpdatedAt: now.toISOString(),
-        });
-      }
-
-      await batch.commit();
+      const batchLimit = 500;
+
+      for (let i = 0; i < events.length; i += batchLimit) {
+        const chunk = events.slice(i, i + batchLimit);
+        const batch = db.batch();
+
+        for (const event of chunk) {
+          // Formula: (Tickets Sold * 10) + (Heat Signal * 5) - (Days to Event penalty)
+          // Simplified for Phase 2:
+          const ticketsSold = event.ticketsStats?.totalSold || 0;
+          const views = event.analytics?.views || 0;
+
+          // Base score
+          let score = ticketsSold * 10 + views * 0.5;
+
+          // Recency/Urgency: More heat if event is soon (but not past)
+          const eventStart = new Date(event.startDate);
+          const diffDays = (eventStart - now) / (1000 * 60 * 60 * 24);
+
+          if (diffDays > 0 && diffDays < 7) {
+            score += (7 - diffDays) * 20; // Up to 140 points for urgency
+          }
+
+          batch.update(db.collection('events').doc(event.id), {
+            heatScore: score,
+            heatScoreUpdatedAt: now.toISOString(),
+          });
+        }
+
+        await batch.commit();
+      }
+
       return { updated: events.length };
     });
```
