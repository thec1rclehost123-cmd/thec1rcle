# Spotify Integration Plan (For Future Implementation)

The goal is to deeply integrate Spotify throughout the mobile app, allowing users to connect their Spotify accounts, select their Profile Anthem directly from Spotify's catalog, and display their top artists/tracks on their public dating or social profiles.

## Pre-requisites
- A registered **Spotify Developer Application** with a `Client ID` and `Client Secret`. These credentials need to be injected into the API Gateway's environment variables.

## Proposed Changes

### Backend (API Gateway)
We need to handle the OAuth flow and proxy Spotify API requests securely so the `Client Secret` is never exposed to the mobile app.

#### [NEW] `apps/api-gateway/src/routes/v1/spotify.ts`
- `GET /auth`: Redirects to Spotify's authorization URL.
- `GET /callback`: Handles the OAuth callback, exchanges the code for tokens, and securely stores the `spotifyRefreshToken` in the user's Firestore document.
- `GET /search`: Proxies track searches to the Spotify Web API using the server's access token.
- `GET /top-artists`: Fetches the user's top artists using their stored refresh token.

#### [MODIFY] `packages/shared/src/types/user.ts` (or equivalent schema)
- Add `spotifyConnected: boolean` and `spotifyRefreshToken: string` to the user schema.

---

### Mobile App (Frontend)

#### [MODIFY] `apps/mobile-app/package.json`
- Install `expo-auth-session` and `expo-crypto` to handle the OAuth PKCE flow securely on device.

#### [NEW] `apps/mobile-app/hooks/useSpotifyAuth.ts`
- A custom hook that orchestrates the `expo-auth-session` flow, opening the browser to authenticate with Spotify, and securely returning the auth code to the backend.

#### [MODIFY] `apps/mobile-app/app/(tabs)/profile.tsx` & Settings
- Add a dedicated "Connect to Spotify" settings block. 
- Show a green "Connected" badge and disconnect button if they are already authenticated.

#### [MODIFY] `apps/mobile-app/app/profile-creation.tsx` (Anthem Picker)
- Update the song search modal. If Spotify is connected, query our new backend `/search` endpoint instead of the public iTunes API.
- Update the `ProfileAnthem` payload to use `source: 'spotify'` and save the Spotify URI so the track can be opened natively in the Spotify app.

#### [MODIFY] `apps/mobile-app/components/ui/ProfileView.tsx` (or equivalent)
- Add a new "My Top Spotify Artists" section that maps over their top 3-5 artists with images, fetching data from the new `/top-artists` endpoint when the profile mounts.
