import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

async function handler(req) {
    const start = Date.now();
    const results = {
        status: 'Operational',
        timestamp: new Date().toISOString(),
        version: '1.0.0-governance',
        services: {
            auth: 'Healthy',
            database: 'Unknown',
            audit_pipeline: 'Unknown'
        },
        env: {
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            nodeEnv: process.env.NODE_ENV
        }
    };

    try {
        const db = getAdminDb();
        // Database Check
        await db.collection('admin_audit_config').doc('integrity_state').get();
        results.services.database = 'Healthy';

        // Audit Pipeline Check (fetch last 1 log)
        const lastLog = await db.collection('admin_audit_logs').orderBy('sequence', 'desc').limit(1).get();
        results.services.audit_pipeline = lastLog.empty ? 'Empty' : 'Healthy';

    } catch (err) {
        results.status = 'Degraded';
        results.error = err.message;
    }

    const latency = Date.now() - start;
    return NextResponse.json(results, {
        headers: {
            'X-Response-Time': `${latency}ms`,
            'X-System-Anchor': 'thec1rcle-india'
        }
    });
}

export const GET = withAdminAuth(handler);
