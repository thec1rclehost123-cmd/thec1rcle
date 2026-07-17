import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { getAdminStorage } from '@c1rcle/core/admin';
import {
  enrichSupportTicketWithSignedUrls,
  cleanSupportTicketBeforeSave,
  signStorageUrl,
} from '../../lib/signed-urls.js';

const TicketCreateSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(1, 'Description is required'),
  relatedEvent: z.string().optional(),
  relatedEventId: z.string().optional(),
  images: z.array(z.string()).optional().default([]),
  documents: z.array(z.string()).optional().default([]),
  contactMethod: z.string().optional().default('email'),
  partnerId: z.string().optional(),
  currentModule: z.string().optional(),
  browserInfo: z.string().optional(),
  deviceInfo: z.string().optional(),
  appVersion: z.string().optional(),
  errorLogs: z.array(z.string()).optional().default([]),
});

const BugReportSchema = z.object({
  title: z.string().min(1, 'Bug Title is required'),
  description: z.string().min(1, 'Description is required'),
  stepsToReproduce: z.string().min(1, 'Steps to Reproduce are required'),
  expectedResult: z.string().min(1, 'Expected Result is required'),
  actualResult: z.string().min(1, 'Actual Result is required'),
  browserInfo: z.string().min(1, 'Browser Info is required'),
  deviceInfo: z.string().min(1, 'Device Info is required'),
  appVersion: z.string().min(1, 'App Version is required'),
  screenshots: z.array(z.string()).optional().default([]),
  screenRecordings: z.array(z.string()).optional().default([]),
  partnerId: z.string().optional(),
  currentModule: z.string().optional(),
  errorLogs: z.array(z.string()).optional().default([]),
});

const FeatureRequestSchema = z.object({
  title: z.string().min(1, 'Feature Title is required'),
  description: z.string().min(1, 'Description is required'),
});

const ReplySchema = z.object({
  message: z.string().min(1, 'Reply message cannot be empty'),
});

const FeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional().default(''),
  resolved: z.boolean(),
});

const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    title: 'Platform Maintenance Notice',
    content:
      'Scheduled maintenance is planned for next Sunday at 2:00 AM PST. The dashboard may be temporarily offline for 10-15 minutes.',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    tag: 'Scheduled Maintenance',
  },
  {
    id: 'ann-2',
    title: 'New Ticketing Features Released',
    content:
      'You can now set custom ticket inventories and promo codes directly from the Events tab. Check out the updated docs for more details.',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    tag: 'New Feature Releases',
  },
  {
    id: 'ann-3',
    title: 'Critical Security Patch',
    content:
      'We have updated authentication endpoints to enforce enhanced CSRF guards. No action is required from dashboard hosts.',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    tag: 'Security Updates',
  },
  {
    id: 'ann-4',
    title: 'GST Policy Updates',
    content:
      'Platform billing invoices will reflect localized tax compliance structures starting next month.',
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString(),
    tag: 'Policy Changes',
  },
  {
    id: 'ann-5',
    title: 'Known Issue: Payout Delay on Bank Holidays',
    content:
      'Automatic bank sweeps might experience 24-hour delays on regional bank holidays. Check payout schedules for details.',
    createdAt: new Date(Date.now() - 3600000 * 96).toISOString(),
    tag: 'Known Issues',
  },
];

export default async function supportRoutes(fastify: FastifyInstance) {
  const authHandler = [fastify.requireAuth];

  /**
   * POST /api/v1/support/upload
   * Upload an attachment for a support ticket or bug report
   */
  fastify.post(
    '/upload',
    {
      preHandler: [...authHandler],
    },
    async (request: any, reply: any) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'No file uploaded' });

      const buffer = await data.toBuffer();
      const maxBytes = 5 * 1024 * 1024; // 5MB
      if (buffer.length > maxBytes) {
        return reply.status(400).send({ error: 'File must be 5MB or smaller' });
      }

      const ext = (data.filename || 'file').split('.').pop() || 'bin';
      const userId = request.user.uid;
      const storagePath = `support-attachments/${userId}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

      const bucket = getAdminStorage().bucket();
      const file = bucket.file(storagePath);

      await file.save(buffer, {
        metadata: {
          contentType: data.mimetype || 'application/octet-stream',
          metadata: {
            originalName: data.filename || 'file',
            userId,
          },
        },
      });

      const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      const signedUrl = await signStorageUrl(url);

      return {
        success: true,
        url: signedUrl,
        filename: data.filename,
      };
    },
  );

  /**
   * POST /api/v1/support/tickets
   * Create a new support ticket (with smart context and initialized timeline)
   */
  fastify.post(
    '/tickets',
    {
      preHandler: [...authHandler, fastify.validate({ body: TicketCreateSchema })],
    },
    async (request: any, reply) => {
      try {
        const userId = request.user.uid;
        const userEmail = request.user.email || 'anonymous@thec1rcle.com';
        const body = request.body as z.infer<typeof TicketCreateSchema>;

        let estimatedResponseTime = '24 hours';
        if (body.priority === 'critical') estimatedResponseTime = '2 hours';
        else if (body.priority === 'high') estimatedResponseTime = '4 hours';
        else if (body.priority === 'medium') estimatedResponseTime = '12 hours';

        const docRef = fastify.db.collection('support_tickets').doc();

        // 15. Smart Context Harvesting
        const smartContext = {
          partnerId: body.partnerId || '',
          relatedEventId: body.relatedEventId || '',
          currentModule: body.currentModule || 'Overview',
          browserInfo: body.browserInfo || 'Unknown',
          deviceInfo: body.deviceInfo || 'Unknown',
          appVersion: body.appVersion || 'v2.4.1-stable',
          errorLogs: body.errorLogs || [],
          timestamp: new Date().toISOString(),
        };

        // 10. Initial Timeline Event
        const timeline = [
          {
            timestamp: new Date().toISOString(),
            message: 'Ticket Created',
            type: 'status_change',
            actorName: userEmail,
            detail: 'Ticket initialized with status: new',
          },
        ];

        const ticketData = {
          subject: body.subject,
          category: body.category,
          priority: body.priority,
          description: body.description,
          message: body.description, // for admin console compat
          relatedEvent: body.relatedEvent || '',
          images: body.images || [],
          documents: body.documents || [],
          contactMethod: body.contactMethod,
          userId,
          userEmail,
          status: 'new', // 11. Ticket statuses: starts as new
          assignedAgent: 'Unassigned',
          assignedAgentId: '',
          estimatedResponseTime,
          smartContext,
          timeline,
          messages: [
            {
              senderId: userId,
              senderName: userEmail,
              senderRole: 'user',
              content: body.description,
              timestamp: new Date().toISOString(),
            },
          ],
          internalNotes: [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        // Clean signed parameters before saving
        cleanSupportTicketBeforeSave(ticketData);

        await docRef.set(ticketData);

        const snapshot = await docRef.get();
        const responseData = {
          id: docRef.id,
          ...snapshot.data(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const enriched = await enrichSupportTicketWithSignedUrls(responseData);
        return { success: true, ticket: enriched };
      } catch (error: any) {
        fastify.log.error(`Error in POST /support/tickets: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * GET /api/v1/support/tickets
   * Retrieve support tickets for the logged-in user
   */
  fastify.get(
    '/tickets',
    {
      preHandler: authHandler,
    },
    async (request: any, reply) => {
      try {
        const userId = request.user.uid;
        const snapshot = await fastify.db
          .collection('support_tickets')
          .where('userId', '==', userId)
          .get();

        const tickets = snapshot.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
            updatedAt: data.updatedAt?.toDate
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt,
            resolvedAt: data.resolvedAt?.toDate
              ? data.resolvedAt.toDate().toISOString()
              : data.resolvedAt,
          };
        });

        // Sort in memory to avoid index requirements
        tickets.sort((a: any, b: any) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

        const enrichedTickets = await Promise.all(
          tickets.map((ticket: any) => enrichSupportTicketWithSignedUrls(ticket)),
        );

        return { success: true, tickets: enrichedTickets };
      } catch (error: any) {
        fastify.log.error(`Error in GET /support/tickets: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * POST /api/v1/support/tickets/:id/reply
   * Post a reply to an active support ticket (by user)
   */
  fastify.post(
    '/tickets/:id/reply',
    {
      preHandler: [...authHandler, fastify.validate({ body: ReplySchema })],
    },
    async (request: any, reply) => {
      try {
        const userId = request.user.uid;
        const userEmail = request.user.email || 'anonymous@thec1rcle.com';
        const { id } = request.params as { id: string };
        const { message } = request.body as z.infer<typeof ReplySchema>;

        const docRef = fastify.db.collection('support_tickets').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
          return reply.status(404).send({ error: 'Ticket not found' });
        }

        const data = doc.data();
        if (!data) {
          return reply.status(404).send({ error: 'Ticket data not found' });
        }
        // Ownership guard: users may only act on their own tickets
        if (String(data.userId || '') !== request.user.uid) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        const oldTimeline = data.timeline || [];
        const oldMessages = data.messages || [];

        const newReply = {
          senderId: userId,
          senderName: userEmail,
          senderRole: 'user',
          content: message,
          timestamp: new Date().toISOString(),
        };

        const timelineEvent = {
          timestamp: new Date().toISOString(),
          message: 'User Replied',
          type: 'reply',
          actorName: userEmail,
          detail: `Reply content: "${message.slice(0, 40)}..."`,
        };

        // If ticket was "Resolved" or "Waiting for User", setting it back to "Open"
        const nextStatus = 'open';

        await docRef.update({
          messages: [...oldMessages, newReply],
          timeline: [...oldTimeline, timelineEvent],
          status: nextStatus,
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { success: true, message: 'Reply registered successfully' };
      } catch (error: any) {
        fastify.log.error(`Error in POST /support/tickets/:id/reply: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * POST /api/v1/support/tickets/:id/feedback
   * Submit customer satisfaction feedback on a resolved ticket
   */
  fastify.post(
    '/tickets/:id/feedback',
    {
      preHandler: [...authHandler, fastify.validate({ body: FeedbackSchema })],
    },
    async (request: any, reply) => {
      try {
        const userEmail = request.user.email || 'anonymous@thec1rcle.com';
        const { id } = request.params as { id: string };
        const body = request.body as z.infer<typeof FeedbackSchema>;

        const docRef = fastify.db.collection('support_tickets').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
          return reply.status(404).send({ error: 'Ticket not found' });
        }

        const data = doc.data();
        if (!data) {
          return reply.status(404).send({ error: 'Ticket data not found' });
        }
        // Ownership guard: users may only act on their own tickets
        if (String(data.userId || '') !== request.user.uid) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        const oldTimeline = data.timeline || [];

        const feedback = {
          rating: body.rating,
          comment: body.comment,
          resolved: body.resolved,
          submittedAt: new Date().toISOString(),
        };

        const timelineEvent = {
          timestamp: new Date().toISOString(),
          message: 'Customer Satisfaction (CSAT) Feedback Submitted',
          type: 'feedback',
          actorName: userEmail,
          detail: `Rating: ${body.rating}/5 stars. Resolved: ${body.resolved ? 'Yes' : 'No'}`,
        };

        await docRef.update({
          feedback,
          status: 'closed', // CSAT submission automatically marks as Closed
          timeline: [...oldTimeline, timelineEvent],
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { success: true, message: 'Feedback submitted successfully' };
      } catch (error: any) {
        fastify.log.error(`Error in POST /support/tickets/:id/feedback: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * POST /api/v1/support/tickets/:id/reopen
   * Reopen a resolved/closed support ticket
   */
  fastify.post(
    '/tickets/:id/reopen',
    {
      preHandler: authHandler,
    },
    async (request: any, reply) => {
      try {
        const userEmail = request.user.email || 'anonymous@thec1rcle.com';
        const { id } = request.params as { id: string };

        const docRef = fastify.db.collection('support_tickets').doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
          return reply.status(404).send({ error: 'Ticket not found' });
        }

        const data = doc.data();
        if (!data) {
          return reply.status(404).send({ error: 'Ticket data not found' });
        }
        // Ownership guard: users may only act on their own tickets
        if (String(data.userId || '') !== request.user.uid) {
          return reply.status(403).send({ error: 'Forbidden' });
        }
        const oldTimeline = data.timeline || [];

        const timelineEvent = {
          timestamp: new Date().toISOString(),
          message: 'Ticket Reopened by User',
          type: 'status_change',
          actorName: userEmail,
          detail: 'Status changed from closed/resolved to open',
        };

        await docRef.update({
          status: 'open',
          feedback: null, // Clear past feedback on reopen
          timeline: [...oldTimeline, timelineEvent],
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { success: true, message: 'Ticket reopened successfully' };
      } catch (error: any) {
        fastify.log.error(`Error in POST /support/tickets/:id/reopen: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * POST /api/v1/support/bugs
   * Submit a new bug report (incorporating smart context and timeline initialization)
   */
  fastify.post(
    '/bugs',
    {
      preHandler: [...authHandler, fastify.validate({ body: BugReportSchema })],
    },
    async (request: any, reply) => {
      try {
        const userId = request.user.uid;
        const userEmail = request.user.email || 'anonymous@thec1rcle.com';
        const body = request.body as z.infer<typeof BugReportSchema>;

        const docRef = fastify.db.collection('support_tickets').doc();

        const smartContext = {
          partnerId: body.partnerId || '',
          relatedEventId: '',
          currentModule: body.currentModule || 'Report Bug',
          browserInfo: body.browserInfo,
          deviceInfo: body.deviceInfo,
          appVersion: body.appVersion,
          errorLogs: body.errorLogs || [],
          timestamp: new Date().toISOString(),
        };

        const timeline = [
          {
            timestamp: new Date().toISOString(),
            message: 'Bug Report Submitted',
            type: 'status_change',
            actorName: userEmail,
            detail: 'Technical bug report logged with status: new',
          },
        ];

        const ticketData = {
          subject: `[BUG] ${body.title}`,
          category: 'Technical - Bug Report',
          priority: 'high', // Bugs default to high priority
          description: body.description,
          message: body.description,
          stepsToReproduce: body.stepsToReproduce,
          expectedResult: body.expectedResult,
          actualResult: body.actualResult,
          browserInfo: body.browserInfo,
          deviceInfo: body.deviceInfo,
          appVersion: body.appVersion,
          images: body.screenshots || [],
          documents: body.screenRecordings || [],
          contactMethod: 'dashboard',
          userId,
          userEmail,
          status: 'new',
          assignedAgent: 'Unassigned',
          assignedAgentId: '',
          estimatedResponseTime: '4 hours',
          smartContext,
          timeline,
          messages: [
            {
              senderId: userId,
              senderName: userEmail,
              senderRole: 'user',
              content: `Steps to reproduce: ${body.stepsToReproduce}\n\nExpected: ${body.expectedResult}\n\nActual: ${body.actualResult}\n\nDescription: ${body.description}`,
              timestamp: new Date().toISOString(),
            },
          ],
          internalNotes: [],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        // Clean signed parameters before saving
        cleanSupportTicketBeforeSave(ticketData);

        await docRef.set(ticketData);

        const snapshot = await docRef.get();
        const responseData = {
          id: docRef.id,
          ...snapshot.data(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const enriched = await enrichSupportTicketWithSignedUrls(responseData);
        return { success: true, ticket: enriched };
      } catch (error: any) {
        fastify.log.error(`Error in POST /support/bugs: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * GET /api/v1/support/announcements
   * Retrieve platform announcements
   */
  fastify.get(
    '/announcements',
    {
      preHandler: authHandler,
    },
    async (request: any, reply) => {
      try {
        const snapshot = await fastify.db
          .collection('platform_announcements')
          .orderBy('createdAt', 'desc')
          .limit(10)
          .get();

        if (snapshot.empty) {
          return { success: true, announcements: [] };
        }

        const announcements = snapshot.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
          };
        });

        return { success: true, announcements };
      } catch (error: any) {
        fastify.log.error(`Error in GET /support/announcements: ${error.message}`);
        return { success: true, announcements: [] };
      }
    },
  );

  /**
   * GET /api/v1/support/stats
   * Retrieve display card statistics
   */
  fastify.get(
    '/stats',
    {
      preHandler: authHandler,
    },
    async (request: any, reply) => {
      try {
        const userId = request.user.uid;
        const snapshot = await fastify.db
          .collection('support_tickets')
          .where('userId', '==', userId)
          .get();

        let openCount = 0;
        let pendingCount = 0;
        let resolvedCount = 0;

        snapshot.docs.forEach((doc: any) => {
          const status = String(doc.data().status || '').toLowerCase();
          if (status === 'resolved') {
            resolvedCount++;
          } else if (
            status === 'pending' ||
            status === 'waiting for user' ||
            status === 'in progress' ||
            status === 'escalated'
          ) {
            pendingCount++;
          } else {
            openCount++; // 'new' or 'open'
          }
        });

        const hour = new Date().getHours();
        const supportStatus = hour >= 9 && hour < 21 ? 'Online' : 'Offline';

        return {
          success: true,
          stats: {
            openTickets: openCount,
            pendingTickets: pendingCount,
            resolvedTickets: resolvedCount,
            averageResponseTime: '4.5 hours',
            supportStatus,
          },
        };
      } catch (error: any) {
        fastify.log.error(`Error in GET /support/stats: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * GET /api/v1/support/feature-requests
   * Retrieve all feature requests
   */
  fastify.get(
    '/feature-requests',
    {
      preHandler: authHandler,
    },
    async (request: any, reply) => {
      try {
        const snapshot = await fastify.db
          .collection('feature_requests')
          .orderBy('votes', 'desc')
          .get();

        const requests = snapshot.docs.map((doc: any) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
            updatedAt: data.updatedAt?.toDate
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt,
          };
        });

        return { success: true, featureRequests: requests };
      } catch (error: any) {
        fastify.log.error(`Error in GET /support/feature-requests: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * POST /api/v1/support/feature-requests
   * Submit a new feature request
   */
  fastify.post(
    '/feature-requests',
    {
      preHandler: [...authHandler, fastify.validate({ body: FeatureRequestSchema })],
    },
    async (request: any, reply) => {
      try {
        const userId = request.user.uid;
        const userEmail = request.user.email || 'anonymous@thec1rcle.com';
        const body = request.body as z.infer<typeof FeatureRequestSchema>;

        const docRef = fastify.db.collection('feature_requests').doc();
        const requestData = {
          title: body.title,
          description: body.description,
          votes: 1,
          votedUsers: [userId],
          status: 'Under Review',
          userId,
          userEmail,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        await docRef.set(requestData);

        const snapshot = await docRef.get();
        const responseData = {
          id: docRef.id,
          ...snapshot.data(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return { success: true, featureRequest: responseData };
      } catch (error: any) {
        fastify.log.error(`Error in POST /support/feature-requests: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );

  /**
   * POST /api/v1/support/feature-requests/:id/vote
   * Vote on an existing feature request
   */
  fastify.post(
    '/feature-requests/:id/vote',
    {
      preHandler: authHandler,
    },
    async (request: any, reply) => {
      try {
        const userId = request.user.uid;
        const { id } = request.params as { id: string };

        const docRef = fastify.db.collection('feature_requests').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
          return reply.status(404).send({ error: 'Feature request not found' });
        }

        const data = doc.data();
        if (!data) {
          return reply.status(404).send({ error: 'Feature request data not found' });
        }
        const votedUsers = data.votedUsers || [];

        if (votedUsers.includes(userId)) {
          return reply.status(400).send({ error: 'Already voted on this feature request' });
        }

        await docRef.update({
          votes: FieldValue.increment(1),
          votedUsers: FieldValue.arrayUnion(userId),
          updatedAt: FieldValue.serverTimestamp(),
        });

        return { success: true, message: 'Vote registered successfully' };
      } catch (error: any) {
        fastify.log.error(`Error in POST /support/feature-requests/:id/vote: ${error.message}`);
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    },
  );
}
