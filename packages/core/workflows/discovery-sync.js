import { inngest, Events } from '../inngest-client.js';
import { telemetry } from '../telemetry.js';
import { getAdminDb } from '../admin.js';

/**
 * PRODUCTION WORKFLOW: Sync Read Models to Public Discovery
 *
 * Triggered by PUBLIC_DISCOVERY_SYNC.
 */
export const syncPublicDiscovery = inngest.createFunction(
  {
    id: 'sync-public-discovery',
    name: 'Sync Public Discovery Models',
    retries: 3,
    concurrency: {
      limit: 5, // Limit concurrent syncs to avoid Firestore hot spots
    },
  },
  { event: Events.PUBLIC_DISCOVERY_SYNC },
  async ({ event, step }) => {
    const { type, id } = event.data;
    const db = getAdminDb();
    const startTime = Date.now();

    console.log(`[Inngest] Starting discovery sync: type=${type}, id=${id}`);

    // Dynamically import the service
    let PublicDiscoveryService;
    try {
      const mod = await import('../src/domain/services/public-discovery-service.js');
      PublicDiscoveryService = mod.PublicDiscoveryService;
    } catch (e) {
      const mod = await import('../dist/domain/services/public-discovery-service.js');
      PublicDiscoveryService = mod.PublicDiscoveryService;
    }

    const discoveryService = new PublicDiscoveryService(db);

    try {
      await step.run('sync-read-model', async () => {
        if (type === 'event') {
          await discoveryService.syncEventReadModels(id);
        } else if (type === 'host') {
          await discoveryService.syncHostReadModels(id);
        } else if (type === 'venue') {
          await discoveryService.syncVenueReadModels(id);
        } else if (type === 'all') {
          await discoveryService.ensureSeeded();
        }

        const duration = Date.now() - startTime;
        console.log(`[Inngest] Discovery sync completed in ${duration}ms: type=${type}, id=${id}`);

        return { status: 'completed', type, id, durationMs: duration };
      });
    } catch (error) {
      telemetry.error(`[Inngest] Discovery sync failed: ${error.message}`, error, {
        workflow: 'sync-public-discovery',
        type,
        id,
      });
      throw error; // Re-throw for Inngest retries
    }

    return {
      status: 'success',
      type,
      id,
    };
  },
);
