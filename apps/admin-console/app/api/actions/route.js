import { NextResponse } from "next/server";
import { adminStore, TIER2_ACTIONS, TIER3_ACTIONS } from "@/lib/server/adminStore";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

const GOVERNANCE_CONFIG = {
    DUAL_APPROVAL: {
        'EVENT_PAUSE': true,
        'VENUE_SUSPEND': true,
        'VENUE_REINSTATE': true
    }
};

async function handler(req) {
    const start = Date.now();
    try {
        const body = await req.json();
        const { action, targetId, reason, evidence, params } = body;
        const adminId = req.user.uid;
        const adminRole = req.user.admin_role;

        const context = {
            ipAddress: req.user.ipAddress,
            userAgent: req.user.userAgent,
            requestId: req.user.requestId
        };

        if (!action || !targetId) {
            return NextResponse.json({ error: "Action and targetId are required" }, { status: 400 });
        }

        const isTier2 = TIER2_ACTIONS.includes(action);
        const isTier3 = TIER3_ACTIONS.includes(action);

        // --- 🔐 AUTHORITY & POLICY ---
        await adminStore.validateAuthority(adminId, adminRole, action, targetId);

        // --- 🗳️ GOVERNANCE: DUAL APPROVAL PIPELINE ---
        const requiresDualApproval = (isTier2 && GOVERNANCE_CONFIG.DUAL_APPROVAL[action]) || isTier3;

        if (requiresDualApproval && action !== 'ACTION_APPROVE' && action !== 'ACTION_REJECT') {
            await adminStore.proposeAction(adminId, adminRole, {
                action, targetId,
                targetType: params?.type || 'entity',
                reason, evidence, params
            }, context);
            return NextResponse.json({
                success: true,
                message: isTier3
                    ? "Critical Authority Proposed: Tier 3 actions require dual sign-off."
                    : "Authority Proposed: This action requires dual sign-off."
            });
        }

        // --- 🚀 EXECUTION ENGINE ---
        switch (action) {
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
            case 'VENUE_SUSPEND':
                await adminStore.updateVenueStatus(targetId, 'suspended', adminId, reason, evidence, context);
                break;
            case 'VENUE_REINSTATE':
                await adminStore.updateVenueStatus(targetId, 'reinstated', adminId, reason, evidence, context);
                break;
            case 'EVENT_PAUSE':
                await adminStore.setEventStatus(targetId, 'pause', adminId, reason, evidence);
                break;
            case 'EVENT_RESUME':
                await adminStore.setEventStatus(targetId, 'resume', adminId, reason, evidence);
                break;
            case 'ACTION_APPROVE':
                await adminStore.resolveProposal(targetId, adminId, adminRole, 'approved', null, context);
                break;
            case 'ACTION_REJECT':
                await adminStore.resolveProposal(targetId, adminId, adminRole, 'rejected', reason, context);
                break;
            case 'USER_BAN':
                await adminStore.setUserBanStatus(targetId, true, adminId, reason);
                break;
            case 'USER_UNBAN':
                await adminStore.setUserBanStatus(targetId, false, adminId, reason);
                break;
            case 'ONBOARDING_APPROVE':
                await adminStore.approveOnboarding(targetId, adminId, adminRole, reason, context);
                break;
            case 'ONBOARDING_REJECT':
                await adminStore.rejectOnboarding(targetId, adminId, adminRole, reason, context);
                break;
            case 'ONBOARDING_REQUEST_CHANGES':
                await adminStore.requestOnboardingChanges(targetId, adminId, adminRole, reason, context);
                break;
            case 'ADMIN_PROVISION':
                await adminStore.adminProvision(params, adminId, adminRole, reason);
                break;
            case 'FINANCIAL_REFUND':
                await adminStore.financialRefund(targetId, adminId, reason, evidence, params);
                break;
            case 'COMMISSION_ADJUST':
                await adminStore.commissionAdjust(targetId, params.type, params.rate, adminId, reason, evidence);
                break;
            case 'PAYOUT_BATCH_RUN':
                await adminStore.executePayoutBatch(targetId, adminId, reason, evidence);
                break;
            default:
                return NextResponse.json({ error: "Unknown action" }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            correlationId: context.requestId
        });

    } catch (error) {
        console.error("Admin Action Error:", error.message);
        return NextResponse.json({
            error: error.message || "Internal Server Error",
            correlationId: req.user?.requestId || 'N/A'
        }, { status: 500 });
    }
}

export const POST = withAdminAuth(handler);
