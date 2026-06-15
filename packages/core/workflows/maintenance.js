import { inngest, Events } from '../inngest-client.js';

/**
 * PRODUCTION WORKFLOW: Cache Warming & Cold Start Mitigation
 *
 * Periodically pings key API endpoints to keep Firestore
 * and Redis connections warm in serverless/containerized environments.
 */
export const maintenanceWarmup = inngest.createFunction(
  {
    id: 'maintenance-warmup',
    name: 'Maintenance: Cache Warmup',
  },
  { cron: '*/10 * * * *' }, // Every 10 minutes
  async ({ step }) => {
    const baseUrl = process.env.API_GATEWAY_URL || 'http://localhost:4000/api/v1';

    await step.run('ping-key-endpoints', async () => {
      const endpoints = ['/events?limit=1', '/health'];

      const results = [];
      for (const ep of endpoints) {
        try {
          const res = await fetch(`${baseUrl}${ep}`);
          results.push({ endpoint: ep, status: res.status });
        } catch (e) {
          results.push({ endpoint: ep, error: e.message });
        }
      }
      return results;
    });
  },
);
