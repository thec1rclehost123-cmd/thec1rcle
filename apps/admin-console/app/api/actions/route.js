import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminStore, TIER2_ACTIONS, TIER3_ACTIONS } from '@/lib/server/adminStore';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import { rateLimit } from '@/lib/server/rateLimit';
import { logger, logAdminAction, logRateLimit } from '@/lib/server/logger';
import { checkAdminAbuse, recordRateLimitHit } from '@c1rcle/core/attack-detection';
import { getAdminApp } from '@/lib/firebase/admin';
import { getAuth } from 'firebase-admin/auth';

const DatabaseCorrectionParamsSchema = z.object({
  id: z.string().optional(),
  after: z.record(z.string(), z.unknown()),
  type: z.string().optional(),
});

export const dynamic = 'force-dynamic';

const GOVERNANCE_CONFIG = {
  DUAL_APPROVAL: {
    EVENT_PAUSE: true,
    VENUE_SUSPEND: false,
    VENUE_REINSTATE: false,
  },
};

async function handler(req) {
  try {
    if (!(await rateLimit(req, 10))) {
      const adminId = req.user?.uid;
      logRateLimit({ path: '/api/actions', adminId });
      // Increment reputation so repeated rate-limit hits tighten limits further
      await recordRateLimitHit(req.user?.ipAddress || null, adminId || null, '/api/actions');
      return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const body = await req.json();
    const { action, targetId, reason, evidence, params } = body;
    const adminId = req.user.uid;
    const adminRole = req.user.admin_role;

    const context = {
      ipAddress: req.user.ipAddress,
      userAgent: req.user.userAgent,
      requestId: req.user.requestId,
    };

    if (!action || !targetId) {
      return NextResponse.json({ error: 'Action and targetId are required' }, { status: 400 });
    }

    // Idempotency guard for financial actions — prevents double-execution on retry/double-click
    const IDEMPOTENT_ACTIONS = ['FINANCIAL_REFUND', 'PAYOUT_BATCH_RUN'];
    if (IDEMPOTENT_ACTIONS.includes(action) && body.idempotencyKey) {
      const isDuplicate = await adminStore.checkRecentActionDuplicate(
        adminId,
        action,
        targetId,
        body.idempotencyKey,
      );
      if (isDuplicate) {
        logger.warn('admin/actions', 'Duplicate idempotent request rejected', {
          adminId,
          action,
          targetId,
          idempotencyKey: body.idempotencyKey,
          requestId: context.requestId,
        });
        return NextResponse.json({ success: true, idempotent: true });
      }
    }

    const isTier2 = TIER2_ACTIONS.includes(action);
    const isTier3 = TIER3_ACTIONS.includes(action);

    // --- 🔐 AUTHORITY & POLICY ---
    await adminStore.validateAuthority(adminId, adminRole, action, targetId);

    // --- 🗳️ GOVERNANCE: DUAL APPROVAL PIPELINE ---
    const requiresDualApproval = (isTier2 && GOVERNANCE_CONFIG.DUAL_APPROVAL[action]) || isTier3;

    if (requiresDualApproval && action !== 'ACTION_APPROVE' && action !== 'ACTION_REJECT') {
      await adminStore.proposeAction(
        adminId,
        adminRole,
        {
          action,
          targetId,
          targetType: params?.type || 'entity',
          reason,
          evidence,
          params,
        },
        context,
      );
      return NextResponse.json({
        success: true,
        message: isTier3
          ? 'Critical Authority Proposed: Tier 3 actions require dual sign-off.'
          : 'Authority Proposed: This action requires dual sign-off.',
      });
    }

    // --- 🚨 ELEVATED-RISK PRE-CHECK ---
    // If the acting admin's reputation score is above normal tier, require an explicit
    // confirmation field (elevated_ack: true) before executing destructive operations.
    // This catches compromised or misbehaving admin accounts before damage is done.
    const ELEVATED_RISK_ACTIONS = [
      'DATABASE_CORRECTION',
      'ADMIN_PROVISION',
      'FINANCIAL_REFUND',
      'PAYOUT_BATCH_RUN',
    ];
    if (ELEVATED_RISK_ACTIONS.includes(action)) {
      try {
        const { getReputationScore, getRiskTier } = await import('@c1rcle/core/reputation');
        const score = await getReputationScore('admin', adminId);
        const tier = getRiskTier(score);
        if (tier.label !== 'normal' && !body.elevated_ack) {
          logger.warn(
            'admin/actions',
            'Elevated-risk admin — confirmation required before critical action',
            {
              adminId,
              action,
              targetId,
              riskTier: tier.label,
              riskScore: Math.round(score),
              requestId: context.requestId,
            },
          );
          return NextResponse.json(
            {
              error: 'ELEVATED_RISK_CONFIRMATION_REQUIRED',
              riskTier: tier.label,
              riskScore: Math.round(score),
              message:
                'Account has elevated risk signals. Re-submit with elevated_ack: true to confirm intent.',
            },
            { status: 403 },
          );
        }
      } catch (_) {
        /* reputation check failure — do not block, log only */
      }
    }

    // --- 📸 CAPTURE PRE-ACTION STATE FOR AUDIT DELTA ---
    // Fetch the entity state BEFORE mutation so audit logs have full before/after context.
    let stateBefore = null;
    try {
      stateBefore = await adminStore.getEntitySnapshot(targetId, params?.type || null);
    } catch (_) {
      /* non-critical — proceed without snapshot */
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
        await adminStore.updateVenueStatus(
          targetId,
          'suspended',
          adminId,
          reason,
          evidence,
          context,
        );
        break;
      case 'VENUE_REINSTATE':
        await adminStore.updateVenueStatus(
          targetId,
          'reinstated',
          adminId,
          reason,
          evidence,
          context,
        );
        break;
      case 'HOST_SUSPEND':
        await adminStore.updateHostStatus(
          targetId,
          'suspended',
          adminId,
          reason,
          evidence,
          context,
        );
        break;
      case 'HOST_REINSTATE':
        await adminStore.updateHostStatus(targetId, 'active', adminId, reason, evidence, context);
        break;
      case 'EVENT_PAUSE':
        await adminStore.setEventStatus(targetId, 'pause', adminId, reason, evidence);
        break;
      case 'EVENT_RESUME':
        await adminStore.setEventStatus(targetId, 'resume', adminId, reason, evidence);
        break;
      case 'FEATURE_EVENT_PIN':
        await adminStore.setEventFeatured(targetId, true, adminId, reason);
        break;
      case 'FEATURE_EVENT_UNPIN':
        await adminStore.setEventFeatured(targetId, false, adminId, reason);
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
        await adminStore.commissionAdjust(
          targetId,
          params.type,
          params.rate,
          adminId,
          reason,
          evidence,
        );
        break;
      case 'PAYOUT_BATCH_RUN':
        await adminStore.executePayoutBatch(targetId, adminId, reason, evidence);
        break;
      case 'PAYOUT_RELEASE':
        await adminStore.payoutIntervention(
          targetId,
          params?.type || 'host',
          false,
          adminId,
          reason,
          evidence,
        );
        break;
      case 'PROMOTER_SUSPEND':
        await adminStore.updatePromoterStatus(targetId, 'suspended', adminId, reason);
        break;
      case 'PROMOTER_ACTIVATE':
        await adminStore.updatePromoterStatus(targetId, 'active', adminId, reason);
        break;
      case 'PROMOTER_DISABLE':
        await adminStore.updatePromoterStatus(targetId, 'disabled', adminId, reason);
        break;
      case 'WEBHOOK_RETRY':
        await adminStore.retryWebhook(targetId, adminId, reason);
        break;
      case 'SUPPORT_RESOLVE':
        await adminStore.resolveSupportTicket(targetId, adminId, reason);
        break;
      case 'SUPPORT_ASSIGN':
        await adminStore.assignSupportTicket(targetId, params?.agentId, params?.agentName, adminId);
        break;
      case 'SUPPORT_CHANGE_PRIORITY':
        await adminStore.changeSupportTicketPriority(targetId, params?.priority, adminId);
        break;
      case 'SUPPORT_REPLY':
        await adminStore.replyToSupportTicket(
          targetId,
          params?.message,
          adminId,
          req.user?.email || params?.adminEmail || 'Support Agent',
        );
        break;
      case 'SUPPORT_MERGE':
        await adminStore.mergeDuplicateSupportTicket(targetId, params?.duplicateTicketId, adminId);
        break;
      case 'SUPPORT_LINK':
        await adminStore.linkSupportTicket(
          targetId,
          params?.entityType,
          params?.entityId,
          params?.entityName,
          adminId,
        );
        break;
      case 'SUPPORT_ADD_INTERNAL_NOTE':
        await adminStore.addSupportTicketInternalNote(
          targetId,
          params?.note,
          adminId,
          req.user?.email || params?.adminEmail || 'Support Agent',
        );
        break;
      case 'SUPPORT_ESCALATE':
        await adminStore.escalateSupportTicket(targetId, adminId);
        break;
      case 'SUPPORT_CLOSE':
        await adminStore.closeSupportTicket(targetId, adminId);
        break;
      case 'SUPPORT_REOPEN':
        await adminStore.reopenSupportTicket(targetId, adminId);
        break;
      case 'ANNOUNCEMENT_CREATE':
        await adminStore.createPlatformAnnouncement(
          params?.title,
          params?.content,
          params?.tag,
          adminId,
        );
        break;
      case 'ANNOUNCEMENT_DELETE':
        await adminStore.deletePlatformAnnouncement(targetId, adminId);
        break;
      case 'SAFETY_REPORT_DISMISS':
        await adminStore.dismissSafetyReport(targetId, adminId, reason);
        break;
      case 'ADMIN_ROLE_UPDATE':
        await adminStore.adminRoleUpdate(targetId, params?.admin_role, adminId, reason);
        break;
      case 'MEDIA_REPORT_DISMISS':
        await adminStore.dismissMediaReport(targetId, adminId, reason);
        break;
      case 'CONTENT_REMOVE':
        await adminStore.removeContent(targetId, params?.type, adminId, reason);
        break;
      case 'DATABASE_CORRECTION': {
        if (adminRole !== 'super') {
          return NextResponse.json({ error: 'Not Found' }, { status: 404 });
        }
        const parsedParams = DatabaseCorrectionParamsSchema.safeParse(params);
        if (!parsedParams.success) {
          return NextResponse.json(
            { error: 'Invalid params for DATABASE_CORRECTION' },
            { status: 400 },
          );
        }
        await adminStore.databaseCorrection(
          targetId,
          parsedParams.data.id || 'global',
          parsedParams.data.after,
          adminId,
          reason,
          context,
        );
        break;
      }
      case 'PARTNER_REPROVISION':
        await adminStore.partnerReprovision(
          { uid: targetId, partnerType: params?.partnerType, partnerName: params?.partnerName },
          adminId,
          adminRole,
          reason,
        );
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    // Capture post-action state for audit delta
    let stateAfter = null;
    try {
      stateAfter = await adminStore.getEntitySnapshot(targetId, params?.type || null);
    } catch (_) {
      /* non-critical */
    }

    // Persist the before/after delta to the audit log
    if (stateBefore !== null || stateAfter !== null) {
      try {
        await adminStore.appendAuditDelta(
          targetId,
          action,
          adminId,
          { before: stateBefore, after: stateAfter },
          context,
        );
      } catch (_) {
        /* non-critical */
      }
    }

    logAdminAction(action, {
      adminId,
      adminRole,
      targetId,
      requestId: context.requestId,
      requiresDualApproval,
    });

    // Active defense: check for admin abuse burst and immediately revoke session if detected
    const CRITICAL_ACTIONS = [
      'DATABASE_CORRECTION',
      'ADMIN_PROVISION',
      'FINANCIAL_REFUND',
      'PAYOUT_BATCH_RUN',
    ];
    if (CRITICAL_ACTIONS.includes(action)) {
      const abuse = await checkAdminAbuse(adminId);
      if (abuse.detected) {
        logAdminAction('ADMIN_ABUSE_DETECTED', {
          adminId,
          adminRole,
          targetId,
          requestId: context.requestId,
          count: abuse.count,
        });
        // Revoke all Firebase refresh tokens — forces immediate re-auth on next request.
        // suspendAdmin() was already called inside checkAdminAbuse() via attack-detection.
        try {
          const auth = getAuth(getAdminApp());
          await auth.revokeRefreshTokens(adminId);
          logAdminAction('ADMIN_TOKENS_REVOKED', {
            adminId,
            requestId: context.requestId,
            reason: 'abuse_auto_mitigation',
          });
        } catch (revokeErr) {
          logger.error('admin/actions', 'Failed to revoke admin tokens', {
            adminId,
            requestId: context.requestId,
            error: revokeErr.message,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      correlationId: context.requestId,
    });
  } catch (error) {
    logger.error('admin/actions', 'Admin Action Error', {
      error: error.message,
      requestId: req.user?.requestId,
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        correlationId: req.user?.requestId || 'N/A',
      },
      { status: error.statusCode || 500 },
    );
  }
}

export const POST = withAdminAuth(handler);
