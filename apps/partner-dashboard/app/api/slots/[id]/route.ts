import { NextRequest, NextResponse } from "next/server";
import {
    getSlotRequest,
    approveSlotRequest,
    rejectSlotRequest,
    suggestAlternatives
} from "@/lib/server/slotStore";

/**
 * GET /api/slots/[id]
 * Get a specific slot request
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const slotRequest = await getSlotRequest(params.id);

        if (!slotRequest) {
            return NextResponse.json(
                { error: "Slot request not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ slotRequest });
    } catch (error: any) {
        console.error("[Slots API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch slot request" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/slots/[id]
 * Update slot request status (approve, reject, suggest alternatives)
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await req.json();
        const { action, notes, alternativeDates, actor } = body;

        if (!actor || !actor.uid || !actor.role) {
            return NextResponse.json(
                { error: "Actor information required" },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case "approve":
                result = await approveSlotRequest(params.id, actor, notes);
                break;

            case "reject":
                result = await rejectSlotRequest(params.id, actor, notes);
                break;

            case "suggest":
                if (!alternativeDates || alternativeDates.length === 0) {
                    return NextResponse.json(
                        { error: "Alternative dates required for suggestion" },
                        { status: 400 }
                    );
                }
                result = await suggestAlternatives(params.id, actor, alternativeDates, notes);
                break;

            default:
                return NextResponse.json(
                    { error: "Invalid action. Use: approve, reject, or suggest" },
                    { status: 400 }
                );
        }

        return NextResponse.json({ slotRequest: result });
    } catch (error: any) {
        console.error("[Slots API] PATCH Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update slot request" },
            { status: 500 }
        );
    }
}
