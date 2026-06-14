# The C1rcle Engineering Manifesto

> **Mandatory Review:** Every developer (and AI agent) must internalize these principles before starting any task. We build for performance, accuracy, and efficiency.

---

## 1. ⚡ Performance & Lightweight Execution
*   **Zero Bloat:** Never import a heavy library when a utility function suffices. Every kilobyte counts.
*   **Async First:** Non-blocking operations are the default. UI must never hang.
*   **GPU Offloading:** Use CSS hardware acceleration (`translate3d`, `will-change`) for all animations.
*   **Minimalist Rendering:** Optimize React components with `useMemo` and `useCallback` to prevent redundant re-renders. Every frame matters.

## 2. 🏛️ Modern Architecture & Optimization
*   **State-of-the-Art Patterns:** Use modern ESM, functional programming, and the latest stable framework features (e.g., Next.js Server Components).
*   **Tree Shaking:** Write code that is easily tree-shakable. Avoid side-effect-heavy files.
*   **Clean Algorithms:** Prefer $O(1)$ or $O(n)$ complexity. Avoid nested loops and expensive filtering on the main thread.
*   **DRY but Descriptive:** Don't repeat logic, but prioritize readability over clever "golfed" code.

## 3. ☁️ Cloud Cost Optimization (The "Zero-Waste" Policy)
*   **Firestore Efficiency:** 
    *   **Batching:** Group writes into `writeBatch` or transactions.
    *   **Read Minimization:** Use local caching (Zustand/MMKV) and only fetch what changed via `updatedAt` filters.
    *   **No Polling:** Use real-time listeners sparingly; leverage optimized cloud functions for computation.
*   **API Consolidation:** Reduce the number of round-trips. Prefer single, high-density payloads over multiple small requests.
*   **Payload Trimming:** Only send the fields you need. Never `SELECT *` or return entire Firestore documents if 3 fields suffice.

## 4. ✅ Functional Integrity & 100%+ Accuracy
*   **Edge-Case obsessed:** Handle every `null`, `undefined`, and network failure. 100% functionality means it works when the internet is spotty or the data is messy.
*   **Logical Rigor:** If a feature is meant to handle $X$, ensure it handles $X + 1$. Anticipate user actions and system states.
*   **Types as Truth:** Use strict TypeScript types to document intent and prevent runtime failures.
*   **No "Happy Path" Coding:** If there isn't a robust error boundary or fallback UI, the task isn't done.

## 5. 🚀 Speed of Development & Operation
*   **On Its Toes:** The system must feels alive. Fast transitions, optimistic UI updates, and instant feedback.
*   **Quick & Running:** Local dev environment and production builds must be fast. Optimize `turbo.json` and build scripts.
*   **Always Ready:** Ensure code is ready for staging at any moment. No "temporary" hacks that slow down the pipeline.

---

**Remember:** We are building a premium, high-end platform. If it's slow, if it's expensive to run, or if it's buggy, it's not the C1rcle way.
