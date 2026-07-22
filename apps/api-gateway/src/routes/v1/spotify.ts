// @ts-nocheck
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse, buildSuccessResponse } from '../../lib/api-contracts';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || '';
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || '';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_ME_URL = 'https://api.spotify.com/v1/me';

const ExchangeCodeBody = z
  .object({
    code: z.string().min(1),
    redirectUri: z.string().min(1),
  })
  .strict();

async function exchangeSpotifyCode(code: string, redirectUri: string) {
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const tokenRes = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Spotify token exchange failed: ${err}`);
  }

  const tokenData: any = await tokenRes.json();
  return tokenData;
}

async function fetchSpotifyProfile(accessToken: string) {
  const res = await fetch(SPOTIFY_ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify profile fetch failed: ${err}`);
  }
  return res.json();
}

async function refreshSpotifyToken(refreshToken: string) {
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Spotify token refresh failed: ${err}`);
  }

  return res.json();
}

export default async function spotifyRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/spotify/exchange',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: ExchangeCodeBody })],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));
      }

      try {
        const { code, redirectUri } = request.body;
        const tokenData = await exchangeSpotifyCode(code, redirectUri);
        const profile = await fetchSpotifyProfile(tokenData.access_token);

        const spotifyData = {
          connected: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || '',
          expiresAt: Date.now() + tokenData.expires_in * 1000,
          profile: {
            id: profile.id,
            displayName: profile.display_name || profile.id,
            email: profile.email || '',
            avatarUrl: profile.images?.[0]?.url || '',
            profileUrl: `https://open.spotify.com/user/${profile.id}`,
          },
        };

        await fastify.db.collection('users').doc(userId).set(
          { spotify: spotifyData },
          { merge: true },
        );

        return buildSuccessResponse({ connected: true, profile: spotifyData.profile });
      } catch (error: any) {
        request.log.error({ error, userId }, 'Spotify exchange failed');
        return reply.status(500).send(
          buildErrorResponse({ code: 'SPOTIFY_ERROR', message: error.message || 'Failed to connect Spotify', requestId: request.id }),
        );
      }
    },
  );

  fastify.post(
    '/spotify/disconnect',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));
      }

      try {
        await fastify.db.collection('users').doc(userId).update({
          spotify: { connected: false },
        });
        return buildSuccessResponse({ connected: false });
      } catch (error: any) {
        request.log.error({ error, userId }, 'Spotify disconnect failed');
        return reply.status(500).send(
          buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Failed to disconnect Spotify', requestId: request.id }),
        );
      }
    },
  );

  fastify.get(
    '/spotify/me',
    {
      preHandler: [fastify.requireAuth],
    },
    async (request: any, reply) => {
      const userId = request.user?.uid;
      if (!userId) {
        return reply.status(401).send(buildErrorResponse({ code: 'UNAUTHORIZED', message: 'Unauthorized', requestId: request.id }));
      }

      try {
        const doc = await fastify.db.collection('users').doc(userId).get();
        const userData = doc.data();
        const spotify = userData?.spotify;

        if (!spotify?.connected) {
          return reply.status(404).send(
            buildErrorResponse({ code: 'NOT_FOUND', message: 'Spotify not connected', requestId: request.id }),
          );
        }

        return buildSuccessResponse({ connected: true, profile: spotify.profile });
      } catch (error: any) {
        request.log.error({ error, userId }, 'Spotify me failed');
        return reply.status(500).send(
          buildErrorResponse({ code: 'INTERNAL_ERROR', message: 'Failed to get Spotify status', requestId: request.id }),
        );
      }
    },
  );
}
