import { NextResponse } from 'next/server';
import { adminStore } from '@/lib/server/adminStore';
import { withAdminAuth } from '@/lib/server/adminMiddleware';

export const dynamic = 'force-dynamic';

async function handler(req) {
  const start = Date.now();
  const results = {
    status: 'Operational',
    timestamp: new Date().toISOString(),
    version: '1.0.0-governance',
    services: {
      auth: 'Healthy',
      database: 'Unknown',
      audit_pipeline: 'Unknown',
    },
  };

  try {
    const health = await adminStore.getHealthStatus();
    results.services.database = health.database;
    results.services.audit_pipeline = health.audit_pipeline;
  } catch (err) {
    results.status = 'Degraded';
    results.error = err.message;
  }

  const latency = Date.now() - start;
  return NextResponse.json(results, {
    headers: {
      'X-Response-Time': `${latency}ms`,
      'X-System-Anchor': 'c1rcle-staging',
    },
  });
}

export const GET = withAdminAuth(handler);
