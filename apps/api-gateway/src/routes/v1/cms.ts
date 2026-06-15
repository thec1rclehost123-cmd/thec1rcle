import { FastifyInstance } from 'fastify';
// @ts-ignore
import {
  createHighlight,
  updateHighlight,
  addGalleryPhoto,
  initializeVenueFacilities,
} from '@c1rcle/core/cms-engine';
// @ts-ignore
import { hasStaffPermission } from '@c1rcle/core/staff-engine';
import { z } from 'zod';

const VenueIdParam = z.object({ venueId: z.string() }).strict();
const HighlightIdParam = z.object({ id: z.string() }).strict();

const HighlightBody = z
  .object({
    venueId: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    order: z.number().optional(),
  })
  .catchall(z.any());

const GalleryBody = z
  .object({
    venueId: z.string(),
    imageUrl: z.string().url(),
    caption: z.string().optional(),
  })
  .strict();

const FacilitiesInitBody = z
  .object({
    venueId: z.string(),
  })
  .strict();

export default async function cmsRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/cms/highlights
   */
  fastify.post(
    '/highlights',
    {
      preHandler: [fastify.validate({ body: HighlightBody })],
    },
    async (request: any, reply) => {
      const { venueId, ...data } = request.body;
      const actorId = request.user?.uid;

      const canManage = await hasStaffPermission(fastify.db, venueId, actorId, 'editEvents');
      if (!canManage) return reply.status(403).send({ error: 'Unauthorized' });

      const highlight = await createHighlight(fastify.db, venueId, data, actorId);
      return { success: true, highlight };
    },
  );

  /**
   * PATCH /api/v1/cms/highlights/:id
   */
  fastify.patch(
    '/highlights/:id',
    {
      preHandler: [fastify.validate({ params: HighlightIdParam, body: HighlightBody })],
    },
    async (request: any, reply) => {
      const { id } = request.params;
      const { venueId, ...updates } = request.body;
      const actorId = request.user?.uid;

      const canManage = await hasStaffPermission(fastify.db, venueId, actorId, 'editEvents');
      if (!canManage) return reply.status(403).send({ error: 'Unauthorized' });

      await updateHighlight(fastify.db, id, updates, actorId);
      return { success: true };
    },
  );

  /**
   * POST /api/v1/cms/gallery
   */
  fastify.post(
    '/gallery',
    {
      preHandler: [fastify.validate({ body: GalleryBody })],
    },
    async (request: any, reply) => {
      const { venueId, imageUrl, caption } = request.body;
      const actorId = request.user?.uid;

      const canManage = await hasStaffPermission(fastify.db, venueId, actorId, 'editEvents');
      if (!canManage) return reply.status(403).send({ error: 'Unauthorized' });

      const photo = await addGalleryPhoto(fastify.db, venueId, imageUrl, caption);
      return { success: true, photo };
    },
  );

  /**
   * GET /api/v1/cms/venue/:venueId
   */
  fastify.get(
    '/venue/:venueId',
    {
      preHandler: [fastify.validate({ params: VenueIdParam })],
    },
    async (request: any, reply) => {
      const { venueId } = request.params;
      const actorId = request.user?.uid;

      // RBAC: Check access
      const hasAccess = await hasStaffPermission(fastify.db, venueId, actorId, 'viewEvents');
      if (!hasAccess) return reply.status(403).send({ error: 'Unauthorized' });

      const [venueDoc, highlightsSnap, gallerySnap, menuSnap, facilitiesSnap] = await Promise.all([
        fastify.db.collection('venues').doc(venueId).get(),
        fastify.db
          .collection('profile_highlights')
          .where('profileId', '==', venueId)
          .orderBy('order', 'asc')
          .get(),
        fastify.db
          .collection('venue_gallery')
          .where('venueId', '==', venueId)
          .orderBy('order', 'asc')
          .get(),
        fastify.db
          .collection('venue_menu')
          .where('venueId', '==', venueId)
          .orderBy('order', 'asc')
          .get(),
        fastify.db
          .collection('venue_facilities')
          .where('venueId', '==', venueId)
          .orderBy('order', 'asc')
          .get(),
      ]);

      if (!venueDoc.exists) return reply.status(404).send({ error: 'Venue not found' });

      return {
        success: true,
        venue: { id: venueDoc.id, ...venueDoc.data() },
        highlights: highlightsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
        gallery: gallerySnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
        menu: menuSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
        facilities: facilitiesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })),
      };
    },
  );

  /**
   * POST /api/v1/cms/facilities/init
   */
  fastify.post(
    '/facilities/init',
    {
      preHandler: [fastify.validate({ body: FacilitiesInitBody })],
    },
    async (request: any, reply) => {
      const { venueId } = request.body;
      const actorId = request.user?.uid;

      const canManage = await hasStaffPermission(fastify.db, venueId, actorId, 'editEvents');
      if (!canManage) return reply.status(403).send({ error: 'Unauthorized' });

      const facilities = await initializeVenueFacilities(fastify.db, venueId);
      return { success: true, facilities };
    },
  );
}
