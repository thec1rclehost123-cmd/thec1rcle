import { NextResponse } from "next/server";
import { adminStore, TIER2_ACTIONS, TIER3_ACTIONS } from "@/lib/server/adminStore";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

const GOVERNANCE_CONFIG = {
    DUAL_APPROVAL: {
        'EVENT_PAUSE': true, // Requires second sign-off
        'EVENT_RESUME': false, // Reversible, low friction
        'VENUE_SUSPEND': true, // High impact, needs dual eyes
        'VENUE_REINSTATE': true // Trust recovery, needs check
    }
};

async function handler(req) {
    try {
        const body = await req.json();
        const { action, targetId, reason, evidence, params, proposalId } = body;
        const adminId = req.user.uid;
        const adminRole = req.user.admin_role;

        if (!action || !targetId || !reason) {
            return NextResponse.json({ error: "Action, targetId, and reason are required" }, { status: 400 });
        }

        const isTier2 = TIER2_ACTIONS.includes(action);
        const isTier3 = TIER3_ACTIONS.includes(action);

        // --- 🔐 ROLE-BASED ACCESS CONTROL (PIPELINE) ---

        // 1. Support & Content are strictly limited to Tier 1
        const legacyRoles = ['support', 'content'];
        if (legacyRoles.includes(adminRole) && (isTier2 || isTier3)) {
            console.error(`[SECURITY] Tier Violation: ${adminRole} ${adminId} attempted ${action}`);
            return NextResponse.json({ error: "Access Denied: High-tier authority restricted to specialized operators." }, { status: 403 });
        }

        // 2. Finance role is strictly limited to Financial Tier 3 or Tier 1 (no operational Tier 2)
        if (adminRole === 'finance' && isTier2) {
            return NextResponse.json({ error: "Access Denied: Operational intervention is restricted to Ops and Super Admins." }, { status: 403 });
        }

        // 3. Tier 3 requires Super or Finance (checked by resolveProposal later, but blocked here for proposal)
        if (isTier3 && !['super', 'finance'].includes(adminRole)) {
            return NextResponse.json({ error: "Access Denied: Tier 3 authority requires high-level clearance." }, { status: 403 });
        }

        // --- 🗳️ GOVERNANCE: DUAL APPROVAL PIPELINE ---

        const requiresDualApproval = (isTier2 && GOVERNANCE_CONFIG.DUAL_APPROVAL[action]) || isTier3;

        if (requiresDualApproval && !proposalId) {
            // This is a new proposal, not an execution of an existing one
            await adminStore.proposeAction(adminId, adminRole, {
                action, targetId,
                targetType: params?.type || (isTier2 || isTier3 ? action.split('_')[0].toLowerCase() : 'entity'),
                reason, evidence, params
            });
            return NextResponse.json({
                success: true,
                message: isTier3
                    ? "Critical Authority Proposed: Tier 3 actions require dual sign-off and a mandatory 120-minute cooling period."
                    : "Authority Proposed: This action requires dual-approval and has been queued for review."
            });
        }

        // --- 🚀 EXECUTION ENGINE ---

        switch (action) {
            // --- Tier 1 Operations ---
            case 'DISCOVERY_WEIGHT_ADJUST':
                await adminStore.setDiscoveryWeight(params.type, targetId, params.weight, adminId, reason);
                break;
            case 'VERIFICATION_ISSUE':
                await adminStore.setVerificationStatus(params.type, targetId, true, adminId, reason);
                break;
            case 'VERIFICATION_REVOKE':
                await adminStore.setVerificationStatus(params.type, targetId, false, adminId, reason);
                break;
            case 'WARNING_ISSUE':
                await adminStore.issueWarning(params.type, targetId, params.message, adminId, reason);
                break;

            // --- Tier 2 Operations ---
            case 'VENUE_SUSPEND':
                await adminStore.updateVenueStatus(targetId, 'suspended', adminId, reason, evidence);
                break;
            case 'VENUE_REINSTATE':
                await adminStore.updateVenueStatus(targetId, 'reinstated', adminId, reason, evidence);
                break;
            case 'EVENT_PAUSE':
                await adminStore.setEventStatus(targetId, 'pause', adminId, reason, evidence);
                break;
            case 'EVENT_RESUME':
                await adminStore.setEventStatus(targetId, 'resume', adminId, reason, evidence);
                break;

            // --- Approval Management ---
            case 'ACTION_APPROVE':
                await adminStore.resolveProposal(targetId, adminId, adminRole, 'approved');
                break;
            case 'ACTION_REJECT':
                await adminStore.resolveProposal(targetId, adminId, adminRole, 'rejected', reason);
                break;

            // --- Legacy / Core ---
            case 'VENUE_ACTIVATE':
                await adminStore.updateVenueStatus(targetId, 'active', adminId, reason);
                break;
            case 'USER_BAN':
                await adminStore.setUserBanStatus(targetId, true, adminId, reason);
                break;
            case 'USER_UNBAN':
                await adminStore.setUserBanStatus(targetId, false, adminId, reason);
                break;
            case 'HOST_APP_APPROVE':
                await adminStore.updateHostApplication(targetId, 'approved', adminId, reason);
                break;
            case 'HOST_APP_REJECT':
                await adminStore.updateHostApplication(targetId, 'rejected', adminId, reason);
                break;
            default:
                return NextResponse.json({ error: "Unknown action" }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Admin Action Error:", error.message);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}

export const POST = withAdminAuth(handler);
