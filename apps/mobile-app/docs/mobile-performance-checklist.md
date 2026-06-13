# Mobile Performance Checklist

Use this quick checklist before merging UI-heavy mobile changes.

1. Explore
- Featured carousel renders only real items, not a repeated rail.
- Auto-advance pauses when the screen is unfocused, while dragging, and when the app is backgrounded.
- Tab bar scroll updates are throttled or threshold-based.

2. Chat
- Event, group, and DM messages use a virtualized list.
- Existing messages do not reanimate when sending or receiving a new message.
- Polling stops when the screen is unfocused or the app is backgrounded.

3. Images And Blur
- Card/list images use cached thumbnails or mobile-sized assets where available.
- Full-screen live blur is avoided or kept low.
- Profile and event headers stay photo-led without high-radius blur.

4. Startup
- Demo data is config-driven and defers non-critical store hydration.
- Analytics console logging is disabled unless explicitly enabled.
- Background intervals are app-state-aware.

5. Acceptance
- App launches in the iOS simulator.
- Explore scroll, tab switching, chat open/send, profile, event detail, and tickets feel responsive.
- `git diff --check` and `npx expo config --type public` pass.
