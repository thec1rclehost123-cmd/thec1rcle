import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { acceptInvite, ROLE_PRESETS } from "@/lib/server/staffService";
import { createStaffProfile, assignProfileToMember } from "@/lib/server/staffProfileStore";
import { ROLE_DEFAULT_TABS, DEFAULT_PII_POLICY } from "@/lib/types/staffProfile";
import { VENUE_PERMISSIONS } from "@/lib/rbac/types";
import type { VenueRole } from "@/lib/types/staffProfile";

// Map invite role → VenueRole for partner_memberships and staff profiles
const ROLE_TO_VENUE_ROLE: Record<string, VenueRole> = {
    STAFF: "STAFF",
    FINANCE_ADMIN: "FINANCE_ADMIN",
    manager: "MANAGER",
    security: "SECURITY",
    scanner: "SECURITY",
    door_staff: "SECURITY",
    supervisor: "MANAGER",
    owner: "OWNER",
};

/**
 * GET /api/venue/staff/accept?code=&venue=
 * Preview invite info (no auth required)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");
        const venueId = searchParams.get("venue");

        if (!code || !venueId) {
            return NextResponse.json({ error: "code and venue are required" }, { status: 400 });
        }

        const db = getAdminDb();

        // Look up invite by code
        const snap = await db
            .collection("venue_staff")
            .where("inviteCode", "==", code)
            .limit(1)
            .get();

        if (snap.empty) {
            return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 404 });
        }

        const staffDoc = snap.docs[0].data();

        if (staffDoc.status !== "invited") {
            return NextResponse.json({ error: "This invitation has already been used or is no longer valid" }, { status: 410 });
        }

        if (staffDoc.inviteExpires && new Date(staffDoc.inviteExpires) < new Date()) {
            return NextResponse.json({ error: "This invitation has expired. Ask your venue owner for a new invite." }, { status: 410 });
        }

        // Fetch venue name
        let venueName = "The Venue";
        try {
            const venueDoc = await db.collection("venues").doc(venueId).get();
            venueName = venueDoc.data()?.name || venueDoc.data()?.venueName || venueName;
        } catch {}

        return NextResponse.json({
            name: staffDoc.name,
            email: staffDoc.email,
            role: staffDoc.role,
            venueName,
        });
    } catch (err: any) {
        console.error("[Staff Accept] GET Error:", err.message);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * POST /api/venue/staff/accept
 * Accept invite: creates Firebase account, users doc, partner_memberships, staff profile
 */
export async function POST(req: NextRequest) {
    try {
        const { inviteCode, venueId, password } = await req.json();

        if (!inviteCode || !venueId || !password) {
            return NextResponse.json({ error: "inviteCode, venueId, and password are required" }, { status: 400 });
        }

        if (password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
        }

        const db = getAdminDb();
        const auth = getAdminAuth();

        // Find invite
        const snap = await db
            .collection("venue_staff")
            .where("inviteCode", "==", inviteCode)
            .limit(1)
            .get();

        if (snap.empty) {
            return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 404 });
        }

        const staffDocRef = snap.docs[0].ref;
        const staffData = snap.docs[0].data();

        if (staffData.status !== "invited") {
            return NextResponse.json({ error: "This invitation has already been used" }, { status: 410 });
        }

        if (staffData.inviteExpires && new Date(staffData.inviteExpires) < new Date()) {
            return NextResponse.json({ error: "This invitation has expired" }, { status: 410 });
        }

        const email = staffData.email as string;
        const name = staffData.name as string;
        const role = staffData.role as string;
        const now = new Date().toISOString();

        // Create Firebase user (or get existing)
        let uid: string;
        try {
            const existingUser = await auth.getUserByEmail(email);
            uid = existingUser.uid;
            // Update password if user already exists
            await auth.updateUser(uid, { password });
        } catch {
            // User doesn't exist, create them
            const newUser = await auth.createUser({
                email,
                password,
                displayName: name,
                emailVerified: true,
            });
            uid = newUser.uid;
        }

        // Create or upsert users doc
        const userRef = db.collection("users").doc(uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            await userRef.set({
                uid,
                email,
                displayName: name,
                isApproved: true,
                createdAt: now,
                updatedAt: now,
            });
        } else {
            await userRef.update({ isApproved: true, updatedAt: now });
        }

        // Create partner_memberships doc
        const memberRef = db.collection("partner_memberships").doc();
        const membershipId = memberRef.id;
        const venueRole: VenueRole = ROLE_TO_VENUE_ROLE[role] || "STAFF";

        await memberRef.set({
            uid,
            partnerId: venueId,
            partnerType: "venue",
            role: venueRole,
            joinedAt: Date.now(),
            isActive: true,
            staffProfileId: null, // will be updated below
            createdAt: now,
            updatedAt: now,
        });

        // Determine tab visibility and action permissions
        const tabVisibility = ROLE_DEFAULT_TABS[venueRole] ?? {};
        const venuePermissions = VENUE_PERMISSIONS[venueRole as keyof typeof VENUE_PERMISSIONS] ?? [];

        // Convert Permission[] to Partial<Record<StaffAction, boolean>>
        // Using a simple mapping from VenueRole permissions to StaffActions
        const actionPermissionsMap: Record<string, boolean> = {};
        if (venuePermissions.includes("VIEW_FINANCIALS")) {
            (["finance:read_overview", "finance:read_ledger", "finance:read_payouts"] as const).forEach(a => { actionPermissionsMap[a] = true; });
        }
        if (venuePermissions.includes("VIEW_ANALYTICS")) {
            actionPermissionsMap["analytics:read"] = true;
        }
        if (venuePermissions.includes("VIEW_GUESTLIST")) {
            (["guestlist:read", "guestlist:check_in"] as const).forEach(a => { actionPermissionsMap[a] = true; });
        }
        if (venuePermissions.includes("MANAGE_TABLES")) {
            actionPermissionsMap["tables:manage"] = true;
        }
        if (venuePermissions.includes("LOG_INCIDENTS")) {
            actionPermissionsMap["registers:read"] = true;
        }

        // Create staff profile
        const staffProfile = await createStaffProfile(
            venueId,
            {
                profileName: `${ROLE_PRESETS[role as keyof typeof ROLE_PRESETS]?.name || role} — ${name}`,
                baseRole: venueRole,
                tabVisibility: tabVisibility as any,
                actionPermissions: actionPermissionsMap as any,
                piiPolicy: DEFAULT_PII_POLICY,
                guestlistScope: venueRole === "STAFF" || venueRole === "SECURITY" ? "read_only" : "editable",
            },
            { uid, name }
        );

        // Link profile to membership
        await assignProfileToMember(venueId, membershipId, staffProfile.id, { uid, name });

        // Accept the invite (update venue_staff doc)
        await acceptInvite(inviteCode, uid, email);

        return NextResponse.json({ ok: true, uid, membershipId, profileId: staffProfile.id });
    } catch (err: any) {
        console.error("[Staff Accept] POST Error:", err.message);
        return NextResponse.json({ error: err.message || "Failed to accept invite" }, { status: 500 });
    }
}
