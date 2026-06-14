/**
 * GET   /api/security/incidents/[id]  — fetch a single incident
 * PATCH /api/security/incidents/[id]  — update status / assignment / resolution
 *
 * Status flow:  flagged → under_review → resolved | false_positive
 */

import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/server/adminMiddleware";
import { getIncident, updateIncident } from "@c1rcle/core/security-logger";

export const dynamic = "force-dynamic";

const VALID_TRANSITIONS = {
    flagged:       ["under_review", "false_positive"],
    under_review:  ["resolved", "false_positive", "flagged"],
    resolved:      [],
    false_positive: [],
};

async function handleGet(_req, { params }) {
    const incident = await getIncident(params.id);
    if (!incident) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, incident });
}

async function handlePatch(req, { params }) {
    const incident = await getIncident(params.id);
    if (!incident) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const { status, assignedTo, resolution } = body;

    // Validate status transition
    if (status) {
        const allowed = VALID_TRANSITIONS[incident.status] || [];
        if (!allowed.includes(status)) {
            return NextResponse.json(
                { error: `Cannot transition from '${incident.status}' to '${status}'` },
                { status: 400 }
            );
        }
    }

    const updates = {};
    if (status)     updates.status     = status;
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;
    if (resolution) {
        updates.resolution = resolution;
        updates.resolvedBy = req.user.uid;
    }

    await updateIncident(params.id, updates);
    return NextResponse.json({ ok: true });
}

export const GET   = withAdminAuth(handleGet);
export const PATCH = withAdminAuth(handlePatch);
