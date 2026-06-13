# Mobile UI Safety Stash

This stash preserves the current mobile UI before the simulator shell cleanup.

## What was backed up

- `routes/`: the current `app/` route tree, including every screen and route file that existed before the cleanup.
- `screens/`: direct copies of the primary preserved tab screens:
  - `explore.tsx` from `app/(tabs)/explore.tsx`
  - `chats-from-inbox.tsx` from `app/(tabs)/inbox.tsx`
  - `dating.tsx` from `app/(tabs)/dating.tsx`
  - `passes-from-tickets.tsx` from `app/(tabs)/tickets.tsx`
  - `profile.tsx` from `app/(tabs)/profile.tsx`
- `components/`: current visual components used by the screen tree.
- `theme/theme.ts`: the current design theme from `lib/design/theme.ts`.
- `assets/`: current image, icon, video, and font assets.
- `mock-data/`: the current demo data from `lib/demo/`.

## Why this stash exists

The cleanup is rebuilding only the Expo simulator shell around the existing mobile screens. This folder is a safety backup so the current UI, route files, visual dependencies, theme, assets, fonts, and local demo data can be restored or compared without touching anything outside the mobile app folder.
