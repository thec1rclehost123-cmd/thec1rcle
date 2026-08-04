import * as AuthSession from 'expo-auth-session';
import { apiFetch } from '@/lib/api';

const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
};

const scopes = ['user-read-private', 'user-read-email'];

export async function startSpotifyOAuth(): Promise<{ connected: boolean; error?: string }> {
  if (!SPOTIFY_CLIENT_ID) {
    return { connected: false, error: 'Spotify Client ID not configured' };
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'c1rcle',
    preferLocalhost: true,
  });

  const authRequest = new AuthSession.AuthRequest({
    clientId: SPOTIFY_CLIENT_ID,
    scopes,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
  });

  const result = await authRequest.promptAsync(discovery, {
    preferEphemeralSession: true,
  });

  if (result.type !== 'success' || !result.params.code) {
    return { connected: false, error: 'Authorization cancelled or failed' };
  }

  try {
    const exchangeRes = await apiFetch('/api/v1/spotify/exchange', {
      method: 'POST',
      body: JSON.stringify({
        code: result.params.code,
        redirectUri,
      }),
    });

    if (!exchangeRes.ok) {
      const err = await exchangeRes.json();
      return { connected: false, error: err?.message || 'Failed to exchange code' };
    }

    return { connected: true };
  } catch (error: any) {
    return { connected: false, error: error?.message || 'Network error' };
  }
}

export async function disconnectSpotify(): Promise<boolean> {
  try {
    const res = await apiFetch('/api/v1/spotify/disconnect', { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}
