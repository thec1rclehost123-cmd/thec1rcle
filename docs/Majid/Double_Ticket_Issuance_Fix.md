# Fix: Race Condition Causes Double Ticket Issuance

## 1) What was actual Bug
In [inngest-client.js](file:///c:/Users/majid/thec1rcle/packages/core/inngest-client.js#L78-L86) inside the `sendEvent` function, the application raced the actual dispatch `inngest.send(event)` against a local `2000`ms timeout using `Promise.race`:

```javascript
const timeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Inngest send timeout')), 2000),
);

const result = await Promise.race([inngest.send(event), timeout]);
```

If the Inngest server was slow to respond (taking more than 2 seconds), the `timeout` promise would reject first. This triggered the local development fallback mechanism in the `catch` block for `Events.TICKET_PURCHASED`, which manually called `issueEntitlements` and saved tickets directly to Firestore.

However, since `inngest.send(event)` was already initiated, it would continue running asynchronously in the background. Once the request eventually completed successfully, Inngest registered the event and fired the standard handler, which also triggered the ticket fulfillment flow. This caused **double ticket issuance** (duplicate tickets) for the same order.

## 2) What is solution to solve that Bug
The solution is to **remove the artificial timeout** from `Promise.race` and let the SDK handle timeouts and retries naturally. By directly awaiting `inngest.send(event)`, the function only executes the `catch` block fallback code on a **definitive send failure** (e.g., if the Inngest server/daemon is completely offline). If Inngest is simply slow to acknowledge but eventually succeeds, it will not trigger the fallback, thereby preventing duplicate ticket fulfillment.

## 3) What Changes You made to fix this Bug
1. **Removed the Timeout & Promise.race**:
   - Modified [inngest-client.js](file:///c:/Users/majid/thec1rcle/packages/core/inngest-client.js#L78-L86) to remove the `timeout` Promise definition and the `Promise.race` logic.
   - Updated the code to directly await the Inngest client send operation: `const result = await inngest.send(event);`.
2. **Preserved Pipeline Compatibility**:
   - Ensured the request follows the standard pipeline flow (Frontend Client/Proxy BFF $\rightarrow$ API Gateway $\rightarrow$ Backend/Inngest Event Dispatching). Removing the client-side timeout does not alter any API headers, request payloads, routing, or middleware expectations.
