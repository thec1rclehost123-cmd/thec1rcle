import { NextRequest, NextResponse } from "next/server";
import {
    addStaffMember,
    listClubStaff,
    updateStaffMember,
    removeStaffMember,
    verifyStaffMember,
    rolePresets
} from "@/lib/server/staffStore";

/**
 * GET /api/club/staff
 * List all staff members for a club
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const clubId = searchParams.get("clubId");
        const isActive = searchParams.get("isActive");

        if (!clubId) {
            return NextResponse.json(
                { error: "clubId is required" },
                { status: 400 }
            );
        }

        const staff = await listClubStaff(clubId, {
            isActive: isActive === "false" ? false : isActive === "all" ? null : true
        });

        return NextResponse.json({
            staff,
            roleOptions: Object.keys(rolePresets)
        });
    } catch (error: any) {
        console.error("[Staff API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch staff" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/club/staff
 * Add a new staff member
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { clubId, email, name, role, phone, addedBy } = body;

        if (!clubId || !email || !name || !role) {
            return NextResponse.json(
                { error: "clubId, email, name, and role are required" },
                { status: 400 }
            );
        }

        if (!rolePresets[role as keyof typeof rolePresets]) {
            return NextResponse.json(
                { error: `Invalid role. Valid roles: ${Object.keys(rolePresets).join(", ")}` },
                { status: 400 }
            );
        }

        const staffMember = await addStaffMember({
            clubId,
            email,
            name,
            role,
            phone,
            addedBy: addedBy || { uid: "system", name: "System" }
        });

        return NextResponse.json({ staff: staffMember }, { status: 201 });
    } catch (error: any) {
        console.error("[Staff API] POST Error:", error);

        if (error.message?.includes("already exists")) {
            return NextResponse.json(
                { error: error.message },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: error.message || "Failed to add staff member" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/club/staff
 * Update a staff member (role, permissions, verify, remove)
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { staffId, action, updates, updatedBy } = body;

        if (!staffId || !action) {
            return NextResponse.json(
                { error: "staffId and action are required" },
                { status: 400 }
            );
        }

        let result;

        switch (action) {
            case "update":
                if (!updates) {
                    return NextResponse.json(
                        { error: "updates object is required for update action" },
                        { status: 400 }
                    );
                }
                result = await updateStaffMember(staffId, updates, updatedBy);
                break;

            case "verify":
                result = await verifyStaffMember(staffId, updatedBy);
                break;

            case "remove":
                result = await removeStaffMember(staffId, updatedBy);
                break;

            default:
                return NextResponse.json(
                    { error: "Invalid action. Valid actions: update, verify, remove" },
                    { status: 400 }
                );
        }

        return NextResponse.json({ staff: result });
    } catch (error: any) {
        console.error("[Staff API] PATCH Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update staff member" },
            { status: 500 }
        );
    }
}
