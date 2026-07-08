/**
 * Spotify Web API helper for anthem search.
 *
 * Uses the Client Credentials flow (no user login required).
 * To enable: set EXPO_PUBLIC_SPOTIFY_CLIENT_ID and EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET
 * in your .env file.
 *
 * Spotify Web API is free to use. Rate limits apply.
 */

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS_BASE = 'https://accounts.spotify.com/api';

const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET || '';

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function fetchAccessToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }

  try {
    const credentials = `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`;
    const encoded = btoa(credentials);
    const response = await fetch(`${SPOTIFY_ACCOUNTS_BASE}/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000 - 60000,
    };

    return cachedToken.accessToken;
  } catch {
    return null;
  }
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string;
  albumArt?: string | null;
  previewUrl?: string | null;
  externalUrl: string;
  source: 'spotify';
}

export async function searchSpotifyTracks(query: string): Promise<SpotifyTrack[]> {
  const token = await fetchAccessToken();
  if (!token) return [];

  try {
    const response = await fetch(
      `${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=12`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as {
      tracks?: {
        items?: Array<{
          id: string;
          name: string;
          artists?: Array<{ name: string }>;
          album?: { images?: Array<{ url: string }> };
          preview_url?: string | null;
          external_urls?: { spotify?: string };
        }>;
      };
    };

    return (data.tracks?.items ?? [])
      .filter((item) => item.name && item.artists?.length)
      .map((item) => ({
        id: item.id,
        name: item.name,
        artists: item.artists?.map((a) => a.name).join(', ') ?? '',
        albumArt: item.album?.images?.[0]?.url ?? null,
        previewUrl: item.preview_url ?? null,
        externalUrl: item.external_urls?.spotify ?? '',
        source: 'spotify' as const,
      }));
  } catch {
    return [];
  }
}

export function isSpotifyConfigured(): boolean {
  return Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
}
