import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildErrorResponse } from '../../lib/api-contracts';

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
                otherType: 'venue',
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
                otherType: 'promoter',
                city: data.city || '',
                photoURL: data.promoterPhotoURL || null,
                createdAt: data.createdAt,
              });
            }
          } else if (role === 'venue') {
            const [partnerSnap, promoterSnap] = await Promise.all([
              fastify.db
                .collection(PARTNERSHIPS_COL)
                .where('venueId', '==', partnerId)
                .get()
                .catch(() => ({ docs: [] as any[] })),
              fastify.db
                .collection(PROMOTER_CONNECTIONS_COL)
                .where('venueId', '==', partnerId)
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
                otherId: data.hostId,
                otherName: data.hostName || '',
                otherType: 'host',
                city: data.hostCity || data.city || '',
                photoURL: data.hostPhotoURL || null,
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
                otherType: 'promoter',
                city: data.city || '',
                photoURL: data.promoterPhotoURL || null,
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
              const isVenue = !!data.venueId;
              connections.push({
                id: doc.id,
                type: 'promoter_connection',
                status: data.status,
                initiatedBy: data.initiatedBy || (isVenue ? 'venue' : 'host'),
                otherId: isVenue ? data.venueId : data.hostId,
                otherName: isVenue ? data.venueName || '' : data.hostName || '',
                otherType: isVenue ? 'venue' : 'host',
                city: data.city || '',
                photoURL: isVenue ? data.venuePhotoURL || null : data.hostPhotoURL || null,
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
            let promoterIdMap = new Map<string, string>();
            if (roleType === 'promoter') {
              try {
                // Resolve only the UIDs on this result page instead of scanning
                // the entire promoters collection. Firestore 'in' allows up to
                // 30 values per query, so batch the lookups.
                const uids = snap.docs.map((d: any) => d.id);
                for (let i = 0; i < uids.length; i += 30) {
                  const chunk = uids.slice(i, i + 30);
                  if (chunk.length === 0) continue;
                  const promotersSnap = await fastify.db
                    .collection('promoters')
                    .where('ownerUid', 'in', chunk)
                    .get();
                  for (const pDoc of promotersSnap.docs) {
                    const ownerUid = pDoc.data().ownerUid;
                    if (ownerUid) promoterIdMap.set(ownerUid, pDoc.id);
                  }
                }
              } catch (err: any) {
                fastify.log.error(`Failed to load promoter IDs in discovery: ${err.message}`);
              }
            }

            const results = snap.docs.map((doc: any) => {
              const data = doc.data();
              const partnerId =
                roleType === 'promoter' ? promoterIdMap.get(doc.id) || doc.id : doc.id;
              return {
                id: partnerId,
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

          const paginatedResults = results
            .slice(offset, offset + limit)
            .map((p: any) => ({ ...p }));

          // Populate connectionStatus dynamically for the paginated page based on the current caller's partnerId & role
          if (partnerId && role) {
            const userConns = new Map<string, { status: string; id: string }>();
            if (role === 'host') {
              const [partnerSnap, promoterSnap] = await Promise.all([
                fastify.db
                  .collection(PARTNERSHIPS_COL)
                  .where('hostId', '==', partnerId)
                  .get()
                  .catch(() => ({ docs: [] })),
                fastify.db
                  .collection(PROMOTER_CONNECTIONS_COL)
                  .where('hostId', '==', partnerId)
                  .get()
                  .catch(() => ({ docs: [] })),
              ]);
              for (const doc of partnerSnap.docs) {
                const data = doc.data();
                userConns.set(data.venueId, { status: data.status, id: doc.id });
              }
              for (const doc of promoterSnap.docs) {
                const data = doc.data();
                userConns.set(data.promoterId, { status: data.status, id: doc.id });
              }
            } else if (role === 'venue') {
              const [partnerSnap, promoterSnap] = await Promise.all([
                fastify.db
                  .collection(PARTNERSHIPS_COL)
                  .where('venueId', '==', partnerId)
                  .get()
                  .catch(() => ({ docs: [] })),
                fastify.db
                  .collection(PROMOTER_CONNECTIONS_COL)
                  .where('venueId', '==', partnerId)
                  .get()
                  .catch(() => ({ docs: [] })),
              ]);
              for (const doc of partnerSnap.docs) {
                const data = doc.data();
                userConns.set(data.hostId, { status: data.status, id: doc.id });
              }
              for (const doc of promoterSnap.docs) {
                const data = doc.data();
                userConns.set(data.promoterId, { status: data.status, id: doc.id });
              }
            } else if (role === 'promoter') {
              const snap = await fastify.db
                .collection(PROMOTER_CONNECTIONS_COL)
                .where('promoterId', '==', partnerId)
                .get()
                .catch(() => ({ docs: [] }));
              for (const doc of snap.docs) {
                const data = doc.data();
                const targetId = data.venueId || data.hostId || data.targetId;
                if (targetId) {
                  userConns.set(targetId, { status: data.status, id: doc.id });
                }
              }
            }

            for (const partner of paginatedResults) {
              const conn = userConns.get(partner.id);
              partner.connectionStatus = conn ? conn.status : null;
              partner.connectionId = conn ? conn.id : null;
            }
          }

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
        let connDoc = await fastify.db.collection(PARTNERSHIPS_COL).doc(connectionId).get();
        let collectionName = PARTNERSHIPS_COL;
        if (!connDoc.exists) {
          connDoc = await fastify.db.collection(PROMOTER_CONNECTIONS_COL).doc(connectionId).get();
          collectionName = PROMOTER_CONNECTIONS_COL;
        }

        if (!connDoc.exists) {
          return reply.status(404).send(
            buildErrorResponse({
              code: 'NOT_FOUND',
              message: 'Connection not found',
              requestId: request.id,
            }),
          );
        }
        // Verify the caller actually owns the partnerId they claim BEFORE
        // inspecting the connection. Otherwise the distinct party-membership
        // errors below let an attacker probe the partnership graph with IDs
        // they don't control.
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

        const conn = connDoc.data() as any;
        const isSender = conn.fromPartnerId === partnerId;
        const isTarget = conn.toPartnerId === partnerId;

        if (!isSender && !isTarget) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Not a party to this connection',
              requestId: request.id,
            }),
          );
        }

        if (['approve', 'reject'].includes(action) && !isTarget) {
          return reply.status(403).send(
            buildErrorResponse({
              code: 'FORBIDDEN',
              message: 'Only the recipient can approve or reject this request',
              requestId: request.id,
            }),
          );
        }

        const statusMap: Record<string, string> = {
          approve: collectionName === PROMOTER_CONNECTIONS_COL ? 'approved' : 'active',
          reject: 'rejected',
          remove: collectionName === PROMOTER_CONNECTIONS_COL ? 'removed' : 'deleted',
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

        const isPromoterConnection =
          data.requesterType === 'promoter' || data.targetType === 'promoter';

        if (isPromoterConnection) {
          // Check for existing pending or active connection request
          let promoterId = data.requesterType === 'promoter' ? data.requesterId : data.targetId;
          const targetPartnerId =
            data.requesterType === 'promoter' ? data.targetId : data.requesterId;
          const targetField =
            data.targetType === 'host' || data.requesterType === 'host' ? 'hostId' : 'venueId';

          // Resolve raw promoter UID to its promoterId if necessary
          if (data.targetType === 'promoter' && !promoterId.startsWith('promoter_')) {
            const promoterSnap = await fastify.db
              .collection('promoters')
              .where('ownerUid', '==', promoterId)
              .limit(1)
              .get();
            if (!promoterSnap.empty) {
              promoterId = promoterSnap.docs[0].id;
            }
          } else if (data.requesterType === 'promoter' && !promoterId.startsWith('promoter_')) {
            const promoterSnap = await fastify.db
              .collection('promoters')
              .where('ownerUid', '==', promoterId)
              .limit(1)
              .get();
            if (!promoterSnap.empty) {
              promoterId = promoterSnap.docs[0].id;
            }
          }

          const existingConn = await fastify.db
            .collection(PROMOTER_CONNECTIONS_COL)
            .where('promoterId', '==', promoterId)
            .where(targetField, '==', targetPartnerId)
            .get();

          const hasActiveOrPending = existingConn.docs.some((doc: any) => {
            const status = doc.data().status;
            return ['pending', 'approved', 'active'].includes(status);
          });

          if (hasActiveOrPending) {
            const doc = existingConn.docs.find((d: any) =>
              ['pending', 'approved', 'active'].includes(d.data().status),
            );
            return { success: true, id: doc?.id, alreadyExists: true };
          }

          const doc: any = {
            ...data,
            status: 'pending',
            initiatedBy: data.requesterType,
            fromPartnerId: data.requesterType === 'promoter' ? promoterId : data.requesterId,
            toPartnerId: data.targetType === 'promoter' ? promoterId : data.targetId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          if (data.requesterType === 'promoter') {
            doc.promoterId = promoterId;
            doc.promoterName = data.requesterName;
            if (data.targetType === 'host') {
              doc.hostId = data.targetId;
              doc.hostName = data.targetName;
            } else if (data.targetType === 'venue') {
              doc.venueId = data.targetId;
              doc.venueName = data.targetName;
            }
          } else {
            doc.promoterId = promoterId;
            doc.promoterName = data.targetName;
            if (data.requesterType === 'host') {
              doc.hostId = data.requesterId;
              doc.hostName = data.requesterName;
            } else if (data.requesterType === 'venue') {
              doc.venueId = data.requesterId;
              doc.venueName = data.requesterName;
            }
          }

          const ref = await fastify.db.collection(PROMOTER_CONNECTIONS_COL).add(doc);

          // Write notification for the recipient partner
          const isPromoterInitiated = doc.initiatedBy === 'promoter';
          const recipientId = isPromoterInitiated ? doc.targetId : doc.promoterId;
          const recipientType = isPromoterInitiated ? doc.targetType : 'promoter';
          // When the venue/host initiated, the sender is the requester — not
          // doc.targetName (which is the promoter recipient's own name).
          const senderName = isPromoterInitiated
            ? doc.promoterName || 'A promoter'
            : data.requesterName || 'A partner';
          const notifType = isPromoterInitiated ? 'promoter_request' : 'connection_request';

          await fastify.db.collection('notifications').add({
            recipientId,
            recipientType,
            type: notifType,
            title: 'New Connection Request',
            message: `${senderName} wants to connect with you.`,
            read: false,
            createdAt: doc.createdAt,
            data: {
              connectionId: ref.id,
              promoterId: doc.promoterId,
              targetId: doc.targetId,
              targetType: doc.targetType,
              initiatedBy: doc.initiatedBy,
            },
          });

          return { success: true, id: ref.id };
        } else {
          // Check for existing pending or active partnership request
          const hostId = data.requesterType === 'host' ? data.requesterId : data.targetId;
          const venueId = data.requesterType === 'venue' ? data.requesterId : data.targetId;

          const existingPartnership = await fastify.db
            .collection(PARTNERSHIPS_COL)
            .where('hostId', '==', hostId)
            .where('venueId', '==', venueId)
            .get();

          const hasActiveOrPending = existingPartnership.docs.some((doc: any) => {
            const status = doc.data().status;
            return ['pending', 'active', 'approved'].includes(status);
          });

          if (hasActiveOrPending) {
            const doc = existingPartnership.docs.find((d: any) =>
              ['pending', 'active', 'approved'].includes(d.data().status),
            );
            return { success: true, id: doc?.id, alreadyExists: true };
          }

          // Direct host-venue partnership.
          // fromPartnerId/toPartnerId are REQUIRED by the PATCH authorization
          // gate (approve/reject); without them every host-venue approval 403s.
          const partnershipDoc: any = {
            ...data,
            status: 'pending',
            initiatedBy: data.requesterType,
            fromPartnerId: data.requesterId,
            toPartnerId: data.targetId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          if (data.requesterType === 'host') {
            partnershipDoc.hostId = data.requesterId;
            partnershipDoc.hostName = data.requesterName;
            partnershipDoc.venueId = data.targetId;
            partnershipDoc.venueName = data.targetName;
          } else if (data.requesterType === 'venue') {
            partnershipDoc.venueId = data.requesterId;
            partnershipDoc.venueName = data.requesterName;
            partnershipDoc.hostId = data.targetId;
            partnershipDoc.hostName = data.targetName;
          }

          const ref = await fastify.db.collection(PARTNERSHIPS_COL).add(partnershipDoc);

          // Write notification for the recipient partner
          const initiatedBy = partnershipDoc.initiatedBy || 'host';
          const recipientId =
            initiatedBy === 'host' ? partnershipDoc.venueId : partnershipDoc.hostId;
          const recipientType = initiatedBy === 'host' ? 'venue' : 'host';
          const senderName =
            initiatedBy === 'host'
              ? partnershipDoc.hostName || 'A host'
              : partnershipDoc.venueName || 'A venue';
          const notifType = initiatedBy === 'host' ? 'host_request' : 'venue_request';

          await fastify.db.collection('notifications').add({
            recipientId,
            recipientType,
            type: notifType,
            title: 'New Connection Request',
            message: `${senderName} wants to connect with you.`,
            read: false,
            createdAt: partnershipDoc.createdAt,
            data: {
              partnershipId: ref.id,
              hostId: partnershipDoc.hostId,
              venueId: partnershipDoc.venueId,
              hostName: partnershipDoc.hostName,
              venueName: partnershipDoc.venueName,
              initiatedBy,
            },
          });

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
