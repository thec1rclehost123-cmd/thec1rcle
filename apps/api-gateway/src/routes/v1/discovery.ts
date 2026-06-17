import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';
import { randomUUID } from 'node:crypto';

const DiscoveryQuerySchema = z.object({
  action: z.enum(['list', 'search', 'get', 'discover']),
  partnerId: z.string().optional(),
  role: z.enum(['venue', 'host', 'promoter']).optional(),
  type: z.string().optional(),
  city: z.string().optional(),
  query: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const DiscoveryPatchSchema = z.object({
  connectionId: z.string(),
  action: z.enum(['approve', 'reject', 'remove']),
  partnerId: z.string(),
  role: z.enum(['venue', 'host', 'promoter']),
});

const DiscoveryPostSchema = z.object({
  requesterId: z.string(),
  requesterType: z.string(),
  requesterName: z.string().optional().default(''),
  targetId: z.string(),
  targetType: z.string().optional().default(''),
  targetName: z.string().optional().default(''),
});

export default async function discoveryRoutes(fastify: FastifyInstance) {
  const PARTNERSHIPS_COL = 'partnerships';
  const PROMOTER_CONNECTIONS_COL = 'promoter_connections';

  /**
   * GET /api/v1/discovery
   */
  fastify.get(
    '/',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ querystring: DiscoveryQuerySchema })],
    },
    async (request: any, reply) => {
      const { action, partnerId, role, type, city, query } = request.query;

      try {
        if (action === 'list' && partnerId) {
          // Verify the authenticated user actually belongs to the requested partner entity.
          try {
            await fastify.verifyPartnerAccess(request, partnerId);
          } catch {
            return reply.status(403).send(
              buildErrorResponse({
                code: 'FORBIDDEN',
                message: 'Access denied to this partner',
                requestId: request.id,
              }),
            );
          }

          const connections: any[] = [];

          if (role === 'host') {
            const [partnerSnap, promoterSnap] = await Promise.all([
              fastify.db
                .collection(PARTNERSHIPS_COL)
                .where('hostId', '==', partnerId)
                .get()
                .catch(() => ({ docs: [] as any[] })),
              fastify.db
                .collection(PROMOTER_CONNECTIONS_COL)
                .where('hostId', '==', partnerId)
                .get()
                .catch(() => ({ docs: [] as any[] })),
            ]);
            for (const doc of (partnerSnap as any).docs) {
              const data = doc.data();
              connections.push({
                id: doc.id,
                type: 'partnership',
                status: data.status,
                initiatedBy: data.initiatedBy || 'host',
                otherId: data.venueId,
                otherName: data.venueName || '',
                city: data.venueCity || data.city || '',
                photoURL: data.venuePhotoURL || null,
                createdAt: data.createdAt,
              });
            }
            for (const doc of (promoterSnap as any).docs) {
              const data = doc.data();
              connections.push({
                id: doc.id,
                type: 'promoter_connection',
                status: data.status,
                initiatedBy: data.initiatedBy || 'promoter',
                otherId: data.promoterId,
                otherName: data.promoterName || '',
                city: data.city || '',
                photoURL: data.promoterPhotoURL || null,
                createdAt: data.createdAt,
              });
            }
          } else if (role === 'venue') {
            const snap = await fastify.db
              .collection(PARTNERSHIPS_COL)
              .where('venueId', '==', partnerId)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            for (const doc of (snap as any).docs) {
              const data = doc.data();
              connections.push({
                id: doc.id,
                type: 'partnership',
                status: data.status,
                initiatedBy: data.initiatedBy || 'host',
                otherId: data.hostId,
                otherName: data.hostName || '',
                city: data.hostCity || data.city || '',
                photoURL: data.hostPhotoURL || null,
                createdAt: data.createdAt,
              });
            }
          } else if (role === 'promoter') {
            const snap = await fastify.db
              .collection(PROMOTER_CONNECTIONS_COL)
              .where('promoterId', '==', partnerId)
              .get()
              .catch(() => ({ docs: [] as any[] }));
            for (const doc of (snap as any).docs) {
              const data = doc.data();
              connections.push({
                id: doc.id,
                type: 'promoter_connection',
                status: data.status,
                initiatedBy: data.initiatedBy || 'host',
                otherId: data.hostId,
                otherName: data.hostName || '',
                city: data.city || '',
                photoURL: data.hostPhotoURL || null,
                createdAt: data.createdAt,
              });
            }
          }

          return { connections };
        }

        if (action === 'search' || action === 'discover') {
          const { search, limit, offset } = request.query;

          const fetchFromCollection = async (collectionName: string, roleType: string) => {
            const cacheKey = `list:${collectionName}:${roleType}:${city || 'global'}`;
            const cached = await fastify.cache.get('discovery', cacheKey);
            if (cached) return cached;

            let q: any = fastify.db.collection(collectionName);
            if (city) q = q.where('city', '==', city);
            if (collectionName === 'users') q = q.where('role', '==', roleType);

            const snap = await q
              .limit(500)
              .get()
              .catch((err: any) => {
                fastify.log.error(`fetchFromCollection error for ${collectionName}: ${err}`);
                return { docs: [] };
              });
            const results = snap.docs.map((doc: any) => {
              const data = doc.data();
              return {
                id: doc.id,
                name: data.displayName || data.name || 'Anonymous',
                type: roleType,
                city: data.city || 'Unknown',
                bio: data.bio || data.description || '',
                avatar: data.photoURL || data.avatar || data.logo || null,
                coverImage: data.coverImage || null,
                isVerified: data.kycStatus === 'verified' || data.isVerified === true,
                eventsCount: data.eventsCount || 0,
                followersCount: data.followersCount || 0,
              };
            });

            // Cache for 10 minutes (600 seconds)
            await fastify.cache.set('discovery', cacheKey, results, 600);
            return results;
          };

          let partners: any[] = [];
          if (type === 'host') {
            partners = await fetchFromCollection('hosts', 'host');
          } else if (type === 'venue') {
            partners = await fetchFromCollection('venues', 'venue');
          } else if (type === 'promoter') {
            partners = await fetchFromCollection('users', 'promoter');
          } else {
            const [hosts, venues, promoters] = await Promise.all([
              fetchFromCollection('hosts', 'host'),
              fetchFromCollection('venues', 'venue'),
              fetchFromCollection('users', 'promoter'),
            ]);
            partners = [...hosts, ...venues, ...promoters];
          }

          let results = partners;
          const searchVal = query || search;
          if (searchVal) {
            const s = searchVal.toLowerCase();
            results = partners.filter(
              (p: any) => p.name.toLowerCase().includes(s) || p.city.toLowerCase().includes(s),
            );
          }

          const paginatedResults = results.slice(offset, offset + limit);

          return { partners: paginatedResults, total: results.length, offset, limit };
        }

        return { connections: [], partners: [] };
      } catch (error: any) {
        fastify.log.error(`Discovery GET error: ${error.message}`);
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch discovery data',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * PATCH /api/v1/discovery
   */
  fastify.patch(
    '/',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: DiscoveryPatchSchema })],
    },
    async (request: any, reply) => {
      const { connectionId, action, partnerId } = request.body;

      try {
        // Read the connection document first and verify the caller owns one side of it.
        let collectionName = PARTNERSHIPS_COL;
        let connDoc = await fastify.db.collection(PARTNERSHIPS_COL).doc(connectionId).get();
        if (!connDoc.exists) {
          connDoc = await fastify.db.collection(PROMOTER_CONNECTIONS_COL).doc(connectionId).get();
          if (!connDoc.exists) {
            return reply.status(404).send(
              buildErrorResponse({
                code: 'NOT_FOUND',
                message: 'Connection not found',
                requestId: request.id,
              }),
            );
          }
          collectionName = PROMOTER_CONNECTIONS_COL;
        }

        const conn = connDoc.data() as any;
        const callerIsParty =
          conn.hostId === partnerId || conn.venueId === partnerId || conn.promoterId === partnerId;
        if (!callerIsParty) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Not a party to this connection',
              requestId: request.id,
            }),
          );
        }
        // Verify the authenticated user actually belongs to the partnerId they claim.
        try {
          await fastify.verifyPartnerAccess(request, partnerId);
        } catch {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Access denied to this partner',
              requestId: request.id,
            }),
          );
        }

        const statusMap: Record<string, string> = {
          approve: 'active',
          reject: 'rejected',
          remove: 'deleted',
        };

        await fastify.db.collection(collectionName).doc(connectionId).update({
          status: statusMap[action],
          updatedAt: new Date().toISOString(),
        });

        return { success: true };
      } catch (error: any) {
        if ((error as any).statusCode) throw error;
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Failed to update partnership',
            requestId: request.id,
          }),
        );
      }
    },
  );

  /**
   * POST /api/v1/discovery
   */
  fastify.post(
    '/',
    {
      preHandler: [fastify.requireAuth, fastify.validate({ body: DiscoveryPostSchema })],
    },
    async (request: any, reply) => {
      const data = request.body;

      try {
        // Verify the caller actually belongs to the entity they claim to represent.
        try {
          await fastify.verifyPartnerAccess(request, data.requesterId);
        } catch {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Cannot submit partnership request on behalf of another partner',
              requestId: request.id,
            }),
          );
        }

        // Fetch requester details
        let reqName = data.requesterName || '';
        let reqPhotoURL = null;
        let reqCity = '';

        if (data.requesterType === 'host') {
          const doc = await fastify.db
            .collection('hosts')
            .doc(data.requesterId)
            .get()
            .catch(() => null);
          if (doc && doc.exists) {
            const d = doc.data();
            reqName = reqName || d.displayName || d.name || '';
            reqPhotoURL = d.photoURL || d.avatar || d.logo || null;
            reqCity = d.city || '';
          }
        } else if (data.requesterType === 'venue') {
          const doc = await fastify.db
            .collection('venues')
            .doc(data.requesterId)
            .get()
            .catch(() => null);
          if (doc && doc.exists) {
            const d = doc.data();
            reqName = reqName || d.displayName || d.name || '';
            reqPhotoURL = d.photoURL || d.avatar || d.logo || null;
            reqCity = d.city || '';
          }
        } else if (data.requesterType === 'promoter') {
          const doc = await fastify.db
            .collection('users')
            .doc(data.requesterId)
            .get()
            .catch(() => null);
          if (doc && doc.exists) {
            const d = doc.data();
            reqName = reqName || d.displayName || d.name || '';
            reqPhotoURL = d.photoURL || d.avatar || d.logo || null;
            reqCity = d.city || '';
          }
        }

        // Fetch target details
        let tgtName = data.targetName || '';
        let tgtPhotoURL = null;
        let tgtCity = '';

        if (data.targetType === 'host') {
          const doc = await fastify.db
            .collection('hosts')
            .doc(data.targetId)
            .get()
            .catch(() => null);
          if (doc && doc.exists) {
            const d = doc.data();
            tgtName = tgtName || d.displayName || d.name || '';
            tgtPhotoURL = d.photoURL || d.avatar || d.logo || null;
            tgtCity = d.city || '';
          }
        } else if (data.targetType === 'venue') {
          const doc = await fastify.db
            .collection('venues')
            .doc(data.targetId)
            .get()
            .catch(() => null);
          if (doc && doc.exists) {
            const d = doc.data();
            tgtName = tgtName || d.displayName || d.name || '';
            tgtPhotoURL = d.photoURL || d.avatar || d.logo || null;
            tgtCity = d.city || '';
          }
        } else if (data.targetType === 'promoter') {
          const doc = await fastify.db
            .collection('users')
            .doc(data.targetId)
            .get()
            .catch(() => null);
          if (doc && doc.exists) {
            const d = doc.data();
            tgtName = tgtName || d.displayName || d.name || '';
            tgtPhotoURL = d.photoURL || d.avatar || d.logo || null;
            tgtCity = d.city || '';
          }
        }

        const isPromoterConnection =
          data.requesterType === 'promoter' || data.targetType === 'promoter';

        if (isPromoterConnection) {
          const hostId = data.requesterType === 'host' ? data.requesterId : data.targetId;
          const promoterId = data.requesterType === 'promoter' ? data.requesterId : data.targetId;
          const hostName = data.requesterType === 'host' ? reqName : tgtName;
          const promoterName = data.requesterType === 'promoter' ? reqName : tgtName;
          const hostPhotoURL = data.requesterType === 'host' ? reqPhotoURL : tgtPhotoURL;
          const promoterPhotoURL = data.requesterType === 'promoter' ? reqPhotoURL : tgtPhotoURL;
          const city = data.requesterType === 'promoter' ? reqCity : tgtCity;

          const docId = randomUUID();
          const connDoc = {
            id: docId,
            hostId,
            promoterId,
            hostName,
            promoterName,
            hostPhotoURL,
            promoterPhotoURL,
            city,
            status: 'pending',
            initiatedBy: data.requesterType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await fastify.db.collection(PROMOTER_CONNECTIONS_COL).doc(docId).set(connDoc);
          return { success: true, id: docId };
        } else {
          const hostId = data.requesterType === 'host' ? data.requesterId : data.targetId;
          const venueId = data.requesterType === 'venue' ? data.requesterId : data.targetId;
          const hostName = data.requesterType === 'host' ? reqName : tgtName;
          const venueName = data.requesterType === 'venue' ? reqName : tgtName;
          const hostPhotoURL = data.requesterType === 'host' ? reqPhotoURL : tgtPhotoURL;
          const venuePhotoURL = data.requesterType === 'venue' ? reqPhotoURL : tgtPhotoURL;
          const hostCity = data.requesterType === 'host' ? reqCity : tgtCity;
          const venueCity = data.requesterType === 'venue' ? reqCity : tgtCity;
          const city = venueCity || hostCity;

          const connDoc = {
            hostId,
            venueId,
            hostName,
            venueName,
            hostPhotoURL,
            venuePhotoURL,
            hostCity,
            venueCity,
            city,
            status: 'pending',
            initiatedBy: data.requesterType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          const ref = await fastify.db.collection(PARTNERSHIPS_COL).add(connDoc);
          return { success: true, id: ref.id };
        }
      } catch (error: any) {
        if ((error as any).statusCode) throw error;
        return reply.status(500).send(
          buildErrorResponse({
            code: 'INTERNAL_ERROR',
            message: 'Failed to request partnership',
            requestId: request.id,
          }),
        );
      }
    },
  );
}
