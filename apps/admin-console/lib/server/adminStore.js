import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Resend } from 'resend';
import { getRedisClient } from '@c1rcle/core/redis';
import { AsyncLocalStorage } from 'node:async_hooks';

export const adminStoreContext = new AsyncLocalStorage();

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_ADDR =
  process.env.NODE_ENV === 'development'
    ? 'THE C1RCLE <onboarding@resend.dev>'
    : 'THE C1RCLE <noreply@thec1rcle.com>';

// Authority Tiering
export const TIER1_ACTIONS = [
  'DISCOVERY_WEIGHT_ADJUST',
  'VERIFICATION_ISSUE',
  'VERIFICATION_REVOKE',
  'WARNING_ISSUE',
  'CONTENT_REMOVE',
  'EVENT_PAUSE',
  'EVENT_RESUME',
  'FEATURE_EVENT_PIN',
  'FEATURE_EVENT_UNPIN',
];

export const ALLOWLIST_ACTIONS = [
  ...TIER1_ACTIONS,
  'ONBOARDING_APPROVE',
  'ONBOARDING_REJECT',
  'ONBOARDING_REQUEST_CHANGES',
  'EVENT_PUBLISH',
  'EVENT_CANCEL',
  'VENUE_SUSPEND',
  'VENUE_REINSTATE',
  'HOST_APP_APPROVE',
  'HOST_APP_REJECT',
  'USER_BAN',
  'USER_UNBAN',
  'USER_WARN',
  'FINANCIAL_REFUND',
  'PARTIAL_REFUND',
  'COMMISSION_ADJUST',
  'FEE_RULE_UPDATE',
  'PAYOUT_FREEZE',
  'PAYOUT_RELEASE',
  'PAYOUT_BATCH_RUN',
  'PROMOTER_SUSPEND',
  'PROMOTER_ACTIVATE',
  'PROMOTER_DISABLE',
  'HOST_SUSPEND',
  'HOST_REINSTATE',
  'WEBHOOK_RETRY',
  'SUPPORT_RESOLVE',
  'SUPPORT_ASSIGN',
  'SUPPORT_CHANGE_PRIORITY',
  'SUPPORT_REPLY',
  'SUPPORT_MERGE',
  'SUPPORT_LINK',
  'SUPPORT_ADD_INTERNAL_NOTE',
  'SUPPORT_ESCALATE',
  'SUPPORT_CLOSE',
  'SUPPORT_REOPEN',
  'ANNOUNCEMENT_CREATE',
  'ANNOUNCEMENT_DELETE',
  'SAFETY_REPORT_DISMISS',
  'MEDIA_REPORT_DISMISS',
  'CONTENT_REMOVE',
  'ADMIN_PROVISION',
  'ADMIN_ROLE_UPDATE',
  'ADMIN_ACCESS_REVOKE',
  'DATABASE_CORRECTION',
  'PARTNER_REPROVISION',
];

export const TIER2_ACTIONS = [
  'ONBOARDING_APPROVE',
  'VENUE_SUSPEND',
  'VENUE_REINSTATE',
  'USER_BAN',
  'FINANCIAL_REFUND',
  'PAYOUT_BATCH_RUN',
  'HOST_SUSPEND',
  'HOST_REINSTATE',
  'PROMOTER_SUSPEND',
  'PROMOTER_ACTIVATE',
];

export const TIER3_ACTIONS = [
  'ADMIN_PROVISION',
  'ADMIN_ACCESS_REVOKE',
  'COMMISSION_ADJUST',
  'PAYOUT_FREEZE',
  'IDENTITY_SUSPEND',
  'IDENTITY_REINSTATE',
];

export const adminStore = {
  // --- 🔐 0. Authority & Governance ---
  async validateAuthority(adminId, role, action, targetId) {
    if (!ALLOWLIST_ACTIONS.includes(action) && !TIER3_ACTIONS.includes(action)) {
      throw new Error(`Unauthorized Action: ${action} is not a valid administrative primitive.`);
    }

    // Tier 3 always requires Super Admin
    if (TIER3_ACTIONS.includes(action) && role !== 'super') {
      throw new Error(`Authority Error: ${action} requires Tier 3 (Super Admin) clearance.`);
    }

    // Tier 2 requires Ops-level or above
    const tier2MinRoles = ['super', 'admin', 'ops', 'finance'];
    if (TIER2_ACTIONS.includes(action) && !tier2MinRoles.includes(role)) {
      throw new Error(`Authority Error: ${action} requires Tier 2 (Ops) clearance.`);
    }

    return true;
  },

  async proposeAction(
    adminId,
    role,
    { action, targetId, targetType, reason, evidence, params },
    context,
  ) {
    const db = getAdminDb();
    const proposalId = `prop_${Date.now()}_${Math.random().toString(36).slice(-4)}`;

    const proposal = {
      id: proposalId,
      action,
      targetId,
      targetType,
      reason: reason || '',
      evidence: evidence || null,
      params: params || {},
      proposerId: adminId,
      proposerRole: role,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h lookup
      context: {
        ...(context || {}),
        riskScore: TIER3_ACTIONS.includes(action) ? 90 : 60,
      },
    };

    await db.collection('proposed_actions').doc(proposalId).set(proposal);
    await this.logAdminAction({
      adminId,
      adminRole: role,
      action: 'AUTHORITY_PROPOSED',
      targetId: proposalId,
      targetType: 'proposal',
      reason: `Proposed ${action} for ${targetId}`,
    });

    return proposalId;
  },

  async resolveProposal(proposalId, resolverId, resolverRole, status, resolutionReason, context) {
    const db = getAdminDb();
    const propRef = db.collection('proposed_actions').doc(proposalId);

    return await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(propRef);
      if (!snapshot.exists) throw new Error('Proposal not found.');
      const proposal = snapshot.data();

      if (proposal.status !== 'pending') {
        return { alreadyProcessed: true, status: proposal.status };
      }

      if (proposal.proposerId === resolverId) {
        throw new Error(
          'Governance Violation: Proposer cannot resolve their own authority request (Dual-Control Policy).',
        );
      }

      transaction.update(propRef, {
        status,
        resolverId,
        resolverRole,
        resolutionReason,
        resolvedAt: FieldValue.serverTimestamp(),
      });

      if (status === 'approved') {
        // Execute the actual action
        await this.executeAction(
          proposal.action,
          proposal.targetId,
          proposal.params,
          resolverId,
          proposal.reason,
          proposal.evidence,
          context,
        );
      }

      await this.logAdminAction({
        adminId: resolverId,
        action: status === 'approved' ? 'AUTHORITY_GRANTED' : 'AUTHORITY_DENIED',
        targetId: proposalId,
        targetType: 'proposal',
        reason: resolutionReason || `Proposal ${status}`,
      });

      return { success: true };
    });
  },

  async executeAction(action, targetId, params, adminId, reason, evidence, context) {
    // Internal router for executing approved proposals
    switch (action) {
      case 'COMMISSION_ADJUST':
        await this.commissionAdjust(targetId, params.type, params.rate, adminId, reason, evidence);
        break;
      case 'PAYOUT_FREEZE':
        await this.payoutIntervention(
          targetId,
          params?.type || 'host',
          true,
          adminId,
          reason,
          evidence,
        );
        break;
      case 'PAYOUT_RELEASE':
        await this.payoutIntervention(
          targetId,
          params?.type || 'host',
          false,
          adminId,
          reason,
          evidence,
        );
        break;
      case 'PROMOTER_SUSPEND':
        await this.updatePromoterStatus(targetId, 'suspended', adminId, reason);
        break;
      case 'PROMOTER_ACTIVATE':
        await this.updatePromoterStatus(targetId, 'active', adminId, reason);
        break;
      case 'PROMOTER_DISABLE':
        await this.updatePromoterStatus(targetId, 'disabled', adminId, reason);
        break;
      case 'VENUE_SUSPEND':
        await this.updateVenueStatus(targetId, 'suspended', adminId, reason, evidence, context);
        break;
      case 'HOST_SUSPEND':
        await this.updateHostStatus(targetId, 'suspended', adminId, reason, evidence, context);
        break;
      case 'HOST_REINSTATE':
        await this.updateHostStatus(targetId, 'active', adminId, reason, evidence, context);
        break;
      case 'FINANCIAL_REFUND':
        await this.financialRefund(targetId, adminId, reason, evidence, params);
        break;
      case 'DATABASE_CORRECTION':
        await this.databaseCorrection(
          targetId,
          params.id || 'global',
          params.after,
          adminId,
          reason,
          context,
        );
        break;
      default:
        throw new Error(
          `Execution Dispatch Error: ${action} is not yet mapped for transactional resolution.`,
        );
    }
  },

  // --- 🛂 1. Onboarding & Approval ---
  async approveOnboarding(requestId, adminId, adminRole, reason, context) {
    const db = getAdminDb();
    const auth = getAdminAuth();
    const requestRef = db.collection('onboarding_requests').doc(requestId);

    return await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(requestRef);
      if (!snapshot.exists) throw new Error('Onboarding request not found.');
      const request = snapshot.data();
      const { uid, type, data } = request;
      const now = FieldValue.serverTimestamp();

      if (request.status === 'approved') return { success: true };

      // 1. Update Request Status
      transaction.update(requestRef, {
        status: 'approved',
        reviewedAt: now,
        reviewerId: adminId,
        updatedAt: now,
      });

      // 2. Provision Entity in siloed collection
      let partnerId = '';
      let partnerType = '';
      let partnerRole = 'OWNER';

      if (type === 'venue') {
        partnerId = `venue_${uid.substring(0, 8)}`;
        partnerType = 'venue';
        const venueRef = db.collection('venues').doc(partnerId);
        transaction.set(venueRef, {
          id: partnerId,
          name: data.name || 'Unknown Venue',
          city: data.city || 'Unknown',
          area: data.area || 'Unknown',
          capacity: data.capacity || '0',
          ownerUid: uid,
          status: 'active',
          tier: data.plan === 'diamond' ? 'premium' : 'standard',
          platformFeeRate: data.plan === 'basic' ? 15 : data.plan === 'silver' ? 12 : 10,
          subscriptionPlan: data.plan || 'basic',
          createdAt: now,
          updatedAt: now,
          isVerified: true,
        });
      } else if (type === 'host') {
        partnerId = `host_${uid.substring(0, 8)}`;
        partnerType = 'host';
        const hostRef = db.collection('hosts').doc(partnerId);
        transaction.set(hostRef, {
          id: partnerId,
          name: data.name || 'Unknown Host',
          role: data.role || 'GENERAL',
          ownerUid: uid,
          status: 'active',
          isVerified: true,
          createdAt: now,
          updatedAt: now,
        });
      } else if (type === 'promoter') {
        partnerId = `promoter_${uid.substring(0, 8)}`;
        partnerType = 'promoter';
        partnerRole = 'PROMOTER';
        const promoterRef = db.collection('promoters').doc(partnerId);
        transaction.set(promoterRef, {
          id: partnerId,
          name: data.name || 'Unknown Promoter',
          ownerUid: uid,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
      }

      // 3. Set Custom Claims for Dashboard Access (Context-Bound Authority)
      const existingClaims = (await auth.getUser(uid)).customClaims || {};
      await auth.setCustomUserClaims(uid, {
        ...existingClaims,
        partnerId,
        partnerType,
        partnerRole,
      });

      // 4. Update Identity Protocol (Signal Approval to Dashboard)
      transaction.update(db.collection('users').doc(uid), {
        isApproved: true,
        role: partnerType === 'venue' ? 'partner' : partnerType,
        updatedAt: now,
      });

      // 5. Create Membership Record for context mapping
      const membershipRef = db.collection('partner_memberships').doc(`${uid}_${partnerId}`);
      transaction.set(membershipRef, {
        uid,
        partnerId,
        partnerType,
        role: partnerRole,
        status: 'active',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      await this.logAdminAction({
        adminId,
        adminRole,
        action: 'ONBOARDING_APPROVE',
        targetId: requestId,
        targetType: 'onboarding_request',
        reason,
        context,
        after: { status: 'approved', partnerId, partnerType },
      });

      // Send approval email (fire-and-forget — outside transaction)
      const partnerEmail = data.email;
      const partnerName = data.name || 'Partner';
      if (resend && partnerEmail) {
        resend.emails
          .send({
            from: FROM_ADDR,
            to: partnerEmail,
            subject: "You're approved — Welcome to C1RCLE",
            html: `
                        <div style="background:#000;color:#fff;padding:40px;font-family:sans-serif;text-align:center;">
                            <h1 style="color:#FF5A00;text-transform:uppercase;letter-spacing:5px;">THE C1RCLE</h1>
                            <p style="text-transform:uppercase;letter-spacing:2px;color:#666;font-size:12px;">Application Approved</p>
                            <div style="margin:32px auto;max-width:420px;text-align:left;">
                                <p style="font-size:16px;font-weight:600;color:#fff;">Congratulations, ${partnerName}!</p>
                                <p style="color:#aaa;font-size:14px;line-height:1.6;">
                                    Your application to join the C1RCLE partner network has been <strong style="color:#FF5A00;">approved</strong>. You can now log in to your dashboard and complete identity verification to unlock all features.
                                </p>
                                <div style="margin:24px 0;text-align:center;">
                                    <a href="${process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://partners.thec1rcle.com'}/login"
                                       style="display:inline-block;background:#FF5A00;color:#fff;padding:14px 32px;border-radius:12px;font-weight:700;text-decoration:none;font-size:14px;letter-spacing:1px;text-transform:uppercase;">
                                        Log In to Dashboard →
                                    </a>
                                </div>
                                <p style="color:#666;font-size:13px;line-height:1.6;">
                                    After logging in, visit the Verification Hub to complete your KYC and set up your payout account.
                                </p>
                            </div>
                            <p style="color:#444;font-size:10px;text-transform:uppercase;margin-top:40px;">
                                THE C1RCLE · Partner Network
                            </p>
                        </div>
                    `,
          })
          .catch((err) => console.error('[adminStore] Approval email error:', err));
      }

      return { success: true };
    });
  },

  async rejectOnboarding(requestId, adminId, adminRole, reason, context) {
    const db = getAdminDb();
    const requestRef = db.collection('onboarding_requests').doc(requestId);

    await requestRef.update({
      status: 'rejected',
      reviewedAt: FieldValue.serverTimestamp(),
      reviewerId: adminId,
      rejectionReason: reason,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      adminRole,
      action: 'ONBOARDING_REJECT',
      targetId: requestId,
      targetType: 'onboarding_request',
      reason,
      context,
      after: { status: 'rejected' },
    });
  },

  async requestOnboardingChanges(requestId, adminId, adminRole, reason, context) {
    const db = getAdminDb();
    const requestRef = db.collection('onboarding_requests').doc(requestId);

    await requestRef.update({
      status: 'changes_requested',
      reviewedAt: FieldValue.serverTimestamp(),
      reviewerId: adminId,
      changeRequestMessage: reason,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      adminRole,
      action: 'ONBOARDING_REQUEST_CHANGES',
      targetId: requestId,
      targetType: 'onboarding_request',
      reason,
      context,
      after: { status: 'changes_requested' },
    });
  },

  // --- 🎉 2. Event Governance ---
  async setEventStatus(eventId, status, adminId, reason, evidence = null) {
    const db = getAdminDb();
    const eventRef = db.collection('events').doc(eventId);
    const snapshot = await eventRef.get();

    if (!snapshot.exists) throw new Error('Event not found');
    const before = snapshot.data();

    if (before.status === 'completed' || before.status === 'past') {
      throw new Error('Safety Violation: Cannot pause/resume a completed or past event.');
    }

    const targetStatus = status === 'pause' ? 'paused' : 'live';
    if (before.status === targetStatus) return;

    await eventRef.update({
      status: targetStatus,
      adminOverride: targetStatus === 'paused',
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      adminRole: null, // Global event status change might lack role in this context
      action: targetStatus === 'paused' ? 'EVENT_PAUSE' : 'EVENT_RESUME',
      targetId: eventId,
      targetType: 'event',
      reason,
      evidence: evidence || null,
      before: { status: before.status },
      after: { status: targetStatus },
    });
  },

  // --- 🛡️ 3. User Governance (Consumer context) ---
  async setUserBanStatus(userId, isBanned, adminId, reason) {
    const db = getAdminDb();
    const userRef = db.collection('users').doc(userId);
    const snapshot = await userRef.get();

    if (!snapshot.exists) throw new Error('User record not found.');
    const before = snapshot.data();

    await userRef.update({
      isBanned,
      bannedAt: isBanned ? FieldValue.serverTimestamp() : null,
      banReason: isBanned ? reason : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      action: isBanned ? 'USER_BAN' : 'USER_UNBAN',
      targetId: userId,
      targetType: 'user',
      reason,
      before: { isBanned: before.isBanned || false },
      after: { isBanned },
    });
  },

  // --- 🧭 4. Discovery & Verification ---
  async setDiscoveryWeight(type, targetId, weight, adminId, reason) {
    const db = getAdminDb();
    const collection =
      type === 'event'
        ? 'events'
        : type === 'venue'
          ? 'venues'
          : type === 'host'
            ? 'hosts'
            : 'users';
    const docRef = db.collection(collection).doc(targetId);

    const numericWeight = parseFloat(weight);
    if (isNaN(numericWeight) || numericWeight < -10 || numericWeight > 50) {
      throw new Error('Weight out of bounds (-10 to 50).');
    }

    await docRef.update({
      discoveryWeight: numericWeight,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      action: 'DISCOVERY_WEIGHT_ADJUST',
      targetId,
      targetType: type,
      reason,
      after: { discoveryWeight: numericWeight },
    });
  },

  async setEventFeatured(eventId, pin, adminId, reason) {
    const db = getAdminDb();
    const spotlightsRef = db.collection('platform_settings').doc('spotlights');
    await spotlightsRef.set(
      { featured: pin ? FieldValue.arrayUnion(eventId) : FieldValue.arrayRemove(eventId) },
      { merge: true },
    );
    await this.logAdminAction({
      adminId,
      action: pin ? 'FEATURE_EVENT_PIN' : 'FEATURE_EVENT_UNPIN',
      targetId: eventId,
      targetType: 'event',
      reason,
      after: { featured: pin },
    });
  },

  async setVerificationStatus(type, targetId, isVerified, adminId, reason) {
    const db = getAdminDb();
    const collection = type === 'venue' ? 'venues' : type === 'host' ? 'hosts' : 'users';
    const docRef = db.collection(collection).doc(targetId);

    await docRef.update({
      isVerified,
      verifiedAt: isVerified ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      action: isVerified ? 'VERIFICATION_ISSUE' : 'VERIFICATION_REVOKE',
      targetId,
      targetType: type,
      reason,
      after: { isVerified },
    });
  },

  async issueWarning(type, targetId, message, adminId, reason) {
    const db = getAdminDb();
    const collection =
      type === 'event'
        ? 'events'
        : type === 'venue'
          ? 'venues'
          : type === 'promoter'
            ? 'promoters'
            : type === 'host'
              ? 'hosts'
              : 'users';
    const docRef = db.collection(collection).doc(targetId);

    await docRef.update({
      warnings: FieldValue.arrayUnion({
        message,
        adminId,
        timestamp: new Date().toISOString(),
        auditReason: reason,
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      action: 'WARNING_ISSUE',
      targetId,
      targetType: type,
      reason,
      after: { warningMessage: message },
    });
  },

  // --- 🏦 5. Financial & Power Actions (Tier 3) ---
  async financialRefund(orderId, adminId, reason, evidence, params) {
    const db = getAdminDb();
    const orderRef = db.collection('orders').doc(orderId);

    return await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists) throw new Error('Order not found.');
      const order = snapshot.data();

      if (order.status === 'refunded') return { success: true };

      transaction.update(orderRef, {
        status: 'refunded',
        refundedAt: FieldValue.serverTimestamp(),
        refundReason: reason,
        updatedAt: FieldValue.serverTimestamp(),
      });

      await this.logAdminAction({
        adminId,
        action: 'FINANCIAL_REFUND',
        targetId: orderId,
        targetType: 'order',
        reason,
        evidence,
        after: { status: 'refunded' },
      });

      return { success: true };
    });
  },

  async commissionAdjust(targetId, targetType, rate, adminId, reason, evidence) {
    const db = getAdminDb();
    const collection = targetType === 'venue' ? 'venues' : 'users';
    const docRef = db.collection(collection).doc(targetId);

    const numericRate = parseFloat(rate);
    if (isNaN(numericRate) || numericRate < 0 || numericRate > 100) {
      throw new Error('Invalid commission rate.');
    }

    await docRef.update({
      platformFeeRate: numericRate,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      action: 'COMMISSION_ADJUST',
      targetId,
      targetType,
      reason,
      evidence,
      after: { platformFeeRate: numericRate },
    });
  },

  async adminProvision({ email, name, role }, adminId, adminRole, reason) {
    const auth = getAdminAuth();
    const db = getAdminDb();

    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (authErr) {
      if (authErr.code === 'auth/user-not-found') {
        const err = new Error(`No such user found with email: ${email}`);
        err.statusCode = 404;
        throw err;
      }
      throw authErr;
    }

    const uid = user.uid;

    await auth.setCustomUserClaims(uid, {
      admin: true,
      admin_role: role,
    });

    // Store admin record in a siloed 'admins' collection
    await db.collection('admins').doc(uid).set({
      uid,
      email,
      displayName: name,
      role,
      status: 'active',
      provisionedBy: adminId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      adminRole,
      action: 'ADMIN_PROVISION',
      targetId: uid,
      targetType: 'user',
      reason,
      after: { role },
    });

    return { success: true };
  },

  // Re-provision a partner with a corrected type (host / venue / promoter).
  // Deactivates all existing memberships, sets new claims, creates a new membership + entity.
  async partnerReprovision({ uid, partnerType, partnerName }, adminId, adminRole, reason) {
    if (!uid || !partnerType)
      throw Object.assign(new Error('uid and partnerType are required'), { statusCode: 400 });
    if (!['host', 'venue', 'promoter'].includes(partnerType)) {
      throw Object.assign(
        new Error(`Invalid partnerType '${partnerType}'. Must be host, venue, or promoter.`),
        { statusCode: 400 },
      );
    }

    const auth = getAdminAuth();
    const db = getAdminDb();
    const now = FieldValue.serverTimestamp();

    const partnerRole = partnerType === 'promoter' ? 'PROMOTER' : 'OWNER';
    const partnerId = `${partnerType}_${uid.substring(0, 8)}`;
    const name = partnerName || 'Unknown';

    // 1. Deactivate all existing memberships for this uid
    const existingSnap = await db.collection('partner_memberships').where('uid', '==', uid).get();
    const batch = db.batch();
    existingSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { isActive: false, status: 'deactivated', updatedAt: now });
    });
    await batch.commit();

    // 2. Create the correct entity document
    const entityRef = db
      .collection(
        partnerType === 'venue' ? 'venues' : partnerType === 'host' ? 'hosts' : 'promoters',
      )
      .doc(partnerId);
    await entityRef.set(
      {
        id: partnerId,
        name,
        ownerUid: uid,
        status: 'active',
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    // 3. Create the new membership record
    const membershipRef = db.collection('partner_memberships').doc(`${uid}_${partnerId}`);
    await membershipRef.set({
      uid,
      partnerId,
      partnerType,
      role: partnerRole,
      status: 'active',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // 4. Update the users doc with the corrected role and approval flag
    await db
      .collection('users')
      .doc(uid)
      .set(
        {
          isApproved: true,
          role: partnerType === 'venue' ? 'partner' : partnerType,
          updatedAt: now,
        },
        { merge: true },
      );

    // 5. Set correct custom claims — replaces any previous partner claims
    const existingClaims = (await auth.getUser(uid)).customClaims || {};
    await auth.setCustomUserClaims(uid, {
      ...existingClaims,
      partnerId,
      partnerType,
      partnerRole,
    });

    await this.logAdminAction({
      adminId,
      adminRole,
      action: 'PARTNER_REPROVISION',
      targetId: uid,
      targetType: 'user',
      reason,
      after: { partnerId, partnerType, partnerRole },
    });

    return { success: true, partnerId, partnerType };
  },

  // --- 🔁 Idempotency check (race-safe): returns true if this action was already submitted ---
  //
  // PRIMARY PATH — Redis SET NX (atomic):
  //   SET NX is a single Redis command: "set this key only if it does not already exist".
  //   Because it is atomic, only ONE of N concurrent requests wins the set.
  //   All others receive null and are rejected as duplicates immediately — no TOCTOU window.
  //
  // FALLBACK PATH — Firestore transaction (when Redis is unavailable):
  //   Firestore transactions use optimistic locking. If two concurrent transactions both
  //   read the idempotency doc as "not found", one commits first and the other retries,
  //   seeing the committed record on retry. Race-safe, but ~20-30ms slower.
  //
  async checkRecentActionDuplicate(adminId, action, targetId, idempotencyKey) {
    const IDEMPOTENCY_TTL_SEC = 300; // 5 minutes

    // ── Primary: Redis SET NX ──────────────────────────────────────────────
    try {
      const redis = getRedisClient();
      if (redis.status === 'ready' || redis.status === 'connecting') {
        const key = `idempotent:admin:${adminId}:${action}:${idempotencyKey}`;
        // 'OK'  → key was just created by this request → first submission, proceed
        // null  → key already existed            → duplicate, reject
        const result = await redis.set(key, '1', 'EX', IDEMPOTENCY_TTL_SEC, 'NX');
        return result === null;
      }
    } catch (error) {
      console.warn(
        '[adminStore] Redis unavailable for idempotency check, falling back to Firestore:',
        error,
      );
    }

    // ── Fallback: Firestore transaction ───────────────────────────────────
    const db = getAdminDb();
    const docRef = db.collection('admin_idempotency').doc(`${adminId}:${action}:${idempotencyKey}`);
    let duplicate = false;
    try {
      await db.runTransaction(async (tx) => {
        const doc = await tx.get(docRef);
        if (doc.exists) {
          const ageMs = Date.now() - (doc.data().createdAt?.toMillis?.() || 0);
          if (ageMs < IDEMPOTENCY_TTL_SEC * 1000) {
            duplicate = true;
            return; // do not write — just mark duplicate and exit
          }
          // Record exists but has expired — fall through to overwrite
        }
        tx.set(docRef, {
          adminId,
          action,
          targetId,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
    } catch (error) {
      console.error(
        '[adminStore] Idempotency Firestore transaction failed, failing open to avoid blocking:',
        error,
      );
    }
    return duplicate;
  },

  async executePayoutBatch(batchId, adminId, reason, evidence) {
    const db = getAdminDb();
    const batchRef = db.collection('payout_batches').doc(batchId);
    await db.runTransaction(async (tx) => {
      const batchDoc = await tx.get(batchRef);
      if (!batchDoc.exists) throw new Error(`Payout batch ${batchId} not found`);
      const batch = batchDoc.data();
      if (batch.status === 'executed') return; // idempotent
      if (!['pending', 'approved'].includes(batch.status)) {
        throw new Error(`Payout batch cannot be executed: status is ${batch.status}`);
      }
      tx.update(batchRef, {
        status: 'executed',
        executedBy: adminId,
        executedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await this.logAdminAction({
      adminId,
      action: 'PAYOUT_BATCH_RUN',
      targetId: batchId,
      targetType: 'payout_batch',
      reason,
      evidence,
      after: { status: 'executed' },
    });
  },

  // --- 📝 6. Logging & Audit ---
  runWithContext(context, fn) {
    return adminStoreContext.run(context, fn);
  },

  async logAdminAction({
    adminId,
    adminRole,
    action,
    targetId,
    targetType,
    reason,
    evidence,
    before,
    after,
    context,
    idempotencyKey,
  }) {
    const db = getAdminDb();
    const activeCtx = adminStoreContext.getStore() || {};

    if (activeCtx.skipInternalLog) {
      // Skip internal logging to let actions/route.js write a single unified log
      return;
    }

    const finalAdminId = adminId || activeCtx.adminId || 'system';
    const finalAdminRole = adminRole || activeCtx.adminRole || null;
    let email = context?.actorEmail || context?.adminEmail || activeCtx.actorEmail || null;
    let name = context?.actorName || context?.adminName || activeCtx.actorName || null;

    if (!email && finalAdminId && finalAdminId !== 'system') {
      try {
        const adminDoc = await db.collection('admins').doc(finalAdminId).get();
        if (adminDoc.exists) {
          const ad = adminDoc.data();
          email = ad.email || null;
          name = ad.displayName || null;
        } else {
          const userDoc = await db.collection('users').doc(finalAdminId).get();
          if (userDoc.exists) {
            const ud = userDoc.data();
            email = ud.email || null;
            name = ud.displayName || null;
          }
        }
      } catch (_) {
        /* proceed with defaults */
      }
    }

    // Dynamic resolution of Target Name
    let targetName = null;
    if (targetId && targetType) {
      try {
        const COLLECTION_MAP = {
          venue: 'venues',
          host: 'hosts',
          promoter: 'promoters',
          event: 'events',
          order: 'orders',
          admin: 'admins',
          ticket: 'tickets',
          webhook: 'failed_webhooks',
          support_ticket: 'support_tickets',
          safety_report: 'safety_reports',
          user: 'users',
          onboarding_request: 'onboarding_requests',
        };
        const col = COLLECTION_MAP[targetType];
        if (col) {
          const snap = await db.collection(col).doc(targetId).get();
          if (snap.exists) {
            const data = snap.data();
            if (targetType === 'venue') {
              targetName = data.name || data.venueName || null;
            } else if (targetType === 'event') {
              targetName = data.title || data.name || null;
            } else if (targetType === 'user') {
              targetName = data.displayName || data.name || data.email || null;
            } else if (targetType === 'onboarding_request') {
              targetName = data.data?.name || data.name || null;
            } else {
              targetName = data.name || data.displayName || null;
            }
          }
        }
      } catch (_) {
        // ignore target name resolution errors
      }
    }

    const finalContext = {
      ipAddress: context?.ipAddress || activeCtx.ipAddress || null,
      userAgent: context?.userAgent || activeCtx.userAgent || null,
      requestId: context?.requestId || activeCtx.requestId || null,
      actorEmail: email || 'system',
      actorName: name || null,
    };

    const log = {
      adminId: finalAdminId,
      admin_uid: finalAdminId, // compatibility
      adminRole: finalAdminRole,
      admin_role: finalAdminRole || 'admin', // compatibility
      actorEmail: email || 'system', // compatibility
      adminEmail: email || 'system', // compatibility
      actorName: name || null,
      displayName: name || null,
      action,
      actionType: action, // compatibility
      targetId: targetId || 'unknown',
      targetType: targetType || 'system',
      targetName: targetName || null,
      reason: reason || '',
      evidence: evidence || null,
      before: before || null,
      after: after || null,
      context: finalContext,
      ip: finalContext.ipAddress || 'internal-node', // compatibility
      status: 'success', // compatibility
      ...(idempotencyKey ? { idempotencyKey } : {}),
      timestamp: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(), // compatibility
    };

    await db.collection('admin_audit_logs').add(log);
  },

  async payoutIntervention(
    entityId,
    entityType = 'host',
    freeze = true,
    adminId,
    reason,
    evidence,
  ) {
    const db = getAdminDb();
    const collection =
      entityType === 'venue' ? 'venues' : entityType === 'promoter' ? 'promoters' : 'hosts';
    await db
      .collection(collection)
      .doc(entityId)
      .update({
        payoutFrozen: freeze,
        payoutFrozenAt: freeze ? FieldValue.serverTimestamp() : null,
        payoutFrozenBy: freeze ? adminId : null,
        updatedAt: FieldValue.serverTimestamp(),
      });
    await this.logAdminAction({
      adminId,
      action: freeze ? 'PAYOUT_FREEZE' : 'PAYOUT_RELEASE',
      targetId: entityId,
      targetType: entityType,
      reason,
      evidence,
    });
  },

  async updatePromoterStatus(promoterId, status, adminId, reason) {
    const db = getAdminDb();
    await db.collection('promoters').doc(promoterId).update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const actionMap = {
      suspended: 'PROMOTER_SUSPEND',
      active: 'PROMOTER_ACTIVATE',
      disabled: 'PROMOTER_DISABLE',
    };
    await this.logAdminAction({
      adminId,
      action: actionMap[status] || 'PROMOTER_STATUS_UPDATE',
      targetId: promoterId,
      targetType: 'promoter',
      reason,
    });
  },

  async retryWebhook(webhookId, adminId, reason) {
    const db = getAdminDb();
    const webhookRef = db.collection('failed_webhooks').doc(webhookId);
    const snap = await webhookRef.get();
    if (!snap.exists) throw Object.assign(new Error('Webhook not found'), { statusCode: 404 });
    await webhookRef.update({
      status: 'pending_retry',
      retryRequestedAt: FieldValue.serverTimestamp(),
      retryRequestedBy: adminId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.logAdminAction({
      adminId,
      action: 'WEBHOOK_RETRY',
      targetId: webhookId,
      targetType: 'webhook',
      reason,
    });
  },

  async resolveSupportTicket(ticketId, adminId, reason) {
    const db = getAdminDb();
    const ref = db.collection('support_tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
    await ref.update({
      status: 'resolved',
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: adminId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.logAdminAction({
      adminId,
      action: 'SUPPORT_RESOLVE',
      targetId: ticketId,
      targetType: 'support_ticket',
      reason,
    });
  },

  async assignSupportTicket(ticketId, agentId, agentName, adminId) {
    const db = getAdminDb();
    const ref = db.collection('support_tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
    const data = snap.data();
    const timeline = data.timeline || [];
    timeline.push({
      timestamp: new Date().toISOString(),
      message: `Ticket Assigned to ${agentName}`,
      type: 'assignment',
      actorName: 'System Admin',
      detail: `Assigned agent ID: ${agentId}`,
    });
    await ref.update({
      assignedAgent: agentName,
      assignedAgentId: agentId,
      status: 'in progress',
      timeline,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.logAdminAction({
      adminId,
      action: 'SUPPORT_ASSIGN',
      targetId: ticketId,
      targetType: 'support_ticket',
      reason: `Assigned to ${agentName}`,
    });
  },

  async changeSupportTicketPriority(ticketId, priority, adminId) {
    const db = getAdminDb();
    const ref = db.collection('support_tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
    const data = snap.data();
    const timeline = data.timeline || [];
    timeline.push({
      timestamp: new Date().toISOString(),
      message: `Priority Changed to ${priority}`,
      type: 'priority_change',
      actorName: 'System Admin',
      detail: `Priority changed from ${data.priority} to ${priority}`,
    });
    await ref.update({
      priority,
      timeline,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.logAdminAction({
      adminId,
      action: 'SUPPORT_CHANGE_PRIORITY',
      targetId: ticketId,
      targetType: 'support_ticket',
      reason: `Priority updated to ${priority}`,
    });
  },

  async replyToSupportTicket(ticketId, message, adminId, adminEmail) {
    const db = getAdminDb();
    const ref = db.collection('support_tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
    const data = snap.data();
    const timeline = data.timeline || [];
    const messages = data.messages || [];

    messages.push({
      senderId: adminId,
      senderName: adminEmail || 'Support Agent',
      senderRole: 'admin',
      content: message,
      timestamp: new Date().toISOString(),
    });

    timeline.push({
      timestamp: new Date().toISOString(),
      message: 'Admin Replied',
      type: 'reply',
      actorName: adminEmail || 'Support Agent',
      detail: `Reply content: "${message.slice(0, 40)}..."`,
    });

    await ref.update({
      messages,
      timeline,
      status: 'waiting for user',
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      action: 'SUPPORT_REPLY',
      targetId: ticketId,
      targetType: 'support_ticket',
      reason: `Replied: ${message.slice(0, 50)}`,
    });
  },

  async mergeDuplicateSupportTicket(ticketId, duplicateTicketId, adminId) {
    if (ticketId === duplicateTicketId) {
      throw Object.assign(new Error('Cannot merge a ticket into itself'), { statusCode: 400 });
    }

    const db = getAdminDb();
    const primaryRef = db.collection('support_tickets').doc(ticketId);
    const primarySnap = await primaryRef.get();
    if (!primarySnap.exists)
      throw Object.assign(new Error('Primary ticket not found'), { statusCode: 404 });

    let dupeRef = db.collection('support_tickets').doc(duplicateTicketId);
    let dupeSnap = await dupeRef.get();

    if (!dupeSnap.exists) {
      // Fallback: Suffix search for short ID match
      const snapshot = await db.collection('support_tickets').get();
      const matchDoc = snapshot.docs.find((d) =>
        d.id.toLowerCase().endsWith(duplicateTicketId.toLowerCase()),
      );
      if (!matchDoc) {
        throw Object.assign(new Error('Duplicate ticket not found'), { statusCode: 404 });
      }
      dupeRef = matchDoc.ref;
      dupeSnap = matchDoc;
    }

    if (dupeSnap.id === ticketId) {
      throw Object.assign(new Error('Cannot merge a ticket into itself'), { statusCode: 400 });
    }

    const primaryData = primarySnap.data();
    const dupeData = dupeSnap.data();

    if (primaryData.mergedInto) {
      throw Object.assign(
        new Error(
          `Cannot merge duplicate ticket because the primary ticket is already merged into ticket ${primaryData.mergedInto.slice(-8).toUpperCase()}`,
        ),
        { statusCode: 400 },
      );
    }

    if (dupeData.mergedInto) {
      throw Object.assign(
        new Error(
          `Ticket ${dupeSnap.id.slice(-8).toUpperCase()} is already merged into ticket ${dupeData.mergedInto.slice(-8).toUpperCase()}`,
        ),
        { statusCode: 400 },
      );
    }

    // 1. Merge timelines
    const primaryTimeline = Array.isArray(primaryData.timeline) ? primaryData.timeline : [];
    primaryTimeline.push({
      timestamp: new Date().toISOString(),
      message: `Merged Duplicate Ticket`,
      type: 'merge',
      actorName: 'System Admin',
      detail: `Merged duplicate ticket ID: ${dupeSnap.id}`,
    });

    // 2. Merge messages & sort chronologically
    const primaryMessages = Array.isArray(primaryData.messages) ? primaryData.messages : [];
    const dupeMessages = Array.isArray(dupeData.messages) ? dupeData.messages : [];
    const annotatedDupeMessages = dupeMessages.map((msg) => ({
      ...msg,
      content: `[Merged from ticket ${dupeSnap.id.slice(-8).toUpperCase()}] ${msg.content}`,
    }));
    const mergedMessages = [...primaryMessages, ...annotatedDupeMessages];
    mergedMessages.sort((a, b) => {
      const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return aTime - bTime;
    });

    // 3. Merge screenshots and document attachments
    const primaryImages = Array.isArray(primaryData.images) ? primaryData.images : [];
    const dupeImages = Array.isArray(dupeData.images) ? dupeData.images : [];
    const primaryDocs = Array.isArray(primaryData.documents) ? primaryData.documents : [];
    const dupeDocs = Array.isArray(dupeData.documents) ? dupeData.documents : [];
    const mergedImages = Array.from(new Set([...primaryImages, ...dupeImages]));
    const mergedDocs = Array.from(new Set([...primaryDocs, ...dupeDocs]));

    // 4. Update primary ticket
    await primaryRef.update({
      timeline: primaryTimeline,
      messages: mergedMessages,
      images: mergedImages,
      documents: mergedDocs,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 5. Close and link duplicate ticket
    const dupeTimeline = Array.isArray(dupeData.timeline) ? dupeData.timeline : [];
    dupeTimeline.push({
      timestamp: new Date().toISOString(),
      message: `Ticket Merged and Closed`,
      type: 'merge',
      actorName: 'System Admin',
      detail: `Merged into primary ticket ID: ${ticketId}`,
    });
    await dupeRef.update({
      status: 'closed',
      mergedInto: ticketId,
      timeline: dupeTimeline,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // 6. Log admin audit action
    await this.logAdminAction({
      adminId,
      action: 'SUPPORT_MERGE',
      targetId: ticketId,
      targetType: 'support_ticket',
      reason: `Merged duplicate ticket ${dupeSnap.id} into primary ticket ${ticketId}`,
    });
  },

  async linkSupportTicket(ticketId, entityType, entityId, entityName, adminId) {
    const db = getAdminDb();
    const ref = db.collection('support_tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
    const data = snap.data();
    const timeline = data.timeline || [];
    timeline.push({
      timestamp: new Date().toISOString(),
      message: `Ticket Linked to ${entityType}`,
      type: 'link',
      actorName: 'System Admin',
      detail: `Linked ${entityType}: ${entityName || entityId}`,
    });

    const updateFields = {};
    if (entityType === 'venue') {
      updateFields.linkedVenueId = entityId;
      updateFields.linkedVenueName = entityName || '';
    } else if (entityType === 'host') {
      updateFields.linkedHostId = entityId;
      updateFields.linkedHostName = entityName || '';
    } else if (entityType === 'promoter') {
      updateFields.linkedPromoterId = entityId;
      updateFields.linkedPromoterName = entityName || '';
    } else if (entityType === 'event') {
      updateFields.linkedEventId = entityId;
      updateFields.linkedEventName = entityName || '';
    } else if (entityType === 'subscription') {
      updateFields.linkedSubscriptionId = entityId;
    }

    await ref.update({
      ...updateFields,
      timeline,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      action: 'SUPPORT_LINK',
      targetId: ticketId,
      targetType: 'support_ticket',
      reason: `Linked to ${entityType} ${entityId}`,
    });
  },

  async addSupportTicketInternalNote(ticketId, note, adminId, adminEmail) {
    const db = getAdminDb();
    const ref = db.collection('support_tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
    const data = snap.data();
    const internalNotes = data.internalNotes || [];

    internalNotes.push({
      authorId: adminId,
      authorName: adminEmail || 'Support Agent',
      content: note,
      timestamp: new Date().toISOString(),
    });

    await ref.update({
      internalNotes,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      action: 'SUPPORT_ADD_INTERNAL_NOTE',
      targetId: ticketId,
      targetType: 'support_ticket',
      reason: `Added internal note: ${note.slice(0, 50)}`,
    });
  },

  async escalateSupportTicket(ticketId, adminId) {
    const db = getAdminDb();
    const ref = db.collection('support_tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
    const data = snap.data();
    const timeline = data.timeline || [];
    timeline.push({
      timestamp: new Date().toISOString(),
      message: 'Ticket Escalated to Technical Team',
      type: 'escalation',
      actorName: 'System Admin',
      detail: 'Status changed to escalated',
    });
    await ref.update({
      status: 'escalated',
      timeline,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.logAdminAction({
      adminId,
      action: 'SUPPORT_ESCALATE',
      targetId: ticketId,
      targetType: 'support_ticket',
      reason: 'Escalated to technical team',
    });
  },

  async closeSupportTicket(ticketId, adminId) {
    const db = getAdminDb();
    const ref = db.collection('support_tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
    const data = snap.data();
    const timeline = data.timeline || [];
    timeline.push({
      timestamp: new Date().toISOString(),
      message: 'Ticket Closed',
      type: 'status_change',
      actorName: 'System Admin',
      detail: 'Status changed to closed',
    });
    await ref.update({
      status: 'closed',
      timeline,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.logAdminAction({
      adminId,
      action: 'SUPPORT_CLOSE',
      targetId: ticketId,
      targetType: 'support_ticket',
      reason: 'Closed ticket',
    });
  },

  async reopenSupportTicket(ticketId, adminId) {
    const db = getAdminDb();
    const ref = db.collection('support_tickets').doc(ticketId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Ticket not found'), { statusCode: 404 });
    const data = snap.data();
    const timeline = data.timeline || [];
    timeline.push({
      timestamp: new Date().toISOString(),
      message: 'Ticket Reopened by Admin',
      type: 'status_change',
      actorName: 'System Admin',
      detail: 'Status changed to open',
    });
    await ref.update({
      status: 'open',
      feedback: null,
      timeline,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.logAdminAction({
      adminId,
      action: 'SUPPORT_REOPEN',
      targetId: ticketId,
      targetType: 'support_ticket',
      reason: 'Reopened ticket',
    });
  },

  async createPlatformAnnouncement(title, content, tag, adminId) {
    const db = getAdminDb();
    const docRef = db.collection('platform_announcements').doc();
    await docRef.set({
      title,
      content,
      tag,
      createdBy: adminId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.logAdminAction({
      adminId,
      action: 'ANNOUNCEMENT_CREATE',
      targetId: docRef.id,
      targetType: 'announcement',
      reason: `Created announcement: ${title}`,
    });
  },

  async deletePlatformAnnouncement(announcementId, adminId) {
    const db = getAdminDb();
    const docRef = db.collection('platform_announcements').doc(announcementId);
    await docRef.delete();
    await this.logAdminAction({
      adminId,
      action: 'ANNOUNCEMENT_DELETE',
      targetId: announcementId,
      targetType: 'announcement',
      reason: `Deleted announcement ${announcementId}`,
    });
  },

  async dismissSafetyReport(reportId, adminId, reason) {
    const db = getAdminDb();
    const ref = db.collection('safety_reports').doc(reportId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Report not found'), { statusCode: 404 });
    await ref.update({
      status: 'dismissed',
      dismissedAt: FieldValue.serverTimestamp(),
      dismissedBy: adminId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.logAdminAction({
      adminId,
      action: 'SAFETY_REPORT_DISMISS',
      targetId: reportId,
      targetType: 'safety_report',
      reason,
    });
  },

  async adminRoleUpdate(adminId, newRole, actingAdminId, reason) {
    const db = getAdminDb();
    const auth = getAdminAuth();
    const ref = db.collection('admins').doc(adminId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Admin not found'), { statusCode: 404 });
    await ref.update({
      admin_role: newRole,
      updatedAt: FieldValue.serverTimestamp(),
    });
    try {
      await auth.setCustomUserClaims(adminId, { admin_role: newRole });
    } catch (error) {
      console.error(`[adminStore] Failed to set custom user claims for admin ${adminId}:`, error);
      throw error;
    }
    await this.logAdminAction({
      adminId: actingAdminId,
      action: 'ADMIN_ROLE_UPDATE',
      targetId: adminId,
      targetType: 'admin',
      reason,
    });
  },

  async updateVenueStatus(venueId, status, adminId, reason, evidence, context) {
    const db = getAdminDb();
    await db.collection('venues').doc(venueId).update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      action: status === 'suspended' ? 'VENUE_SUSPEND' : 'VENUE_REINSTATE',
      targetId: venueId,
      targetType: 'venue',
      reason,
      evidence,
      context,
    });
  },

  async updateHostStatus(hostId, status, adminId, reason, evidence, context) {
    const db = getAdminDb();
    await db.collection('hosts').doc(hostId).update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await this.logAdminAction({
      adminId,
      action: status === 'suspended' ? 'HOST_SUSPEND' : 'HOST_REINSTATE',
      targetId: hostId,
      targetType: 'host',
      reason,
      evidence,
      context,
    });
  },

  async databaseCorrection(collection, targetId, data, adminId, reason, context) {
    const db = getAdminDb();
    const docRef = db.collection(collection).doc(targetId);

    await docRef.set(
      {
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
        lastCorrectedBy: adminId,
      },
      { merge: true },
    );

    await this.logAdminAction({
      adminId,
      action: 'DATABASE_CORRECTION',
      targetId: `${collection}/${targetId}`,
      targetType: 'config',
      reason,
      context,
      after: data,
    });
  },

  // --- 📊 7. Read Queries (admin-console app layer delegates here) ---
  async getPlatformSnapshot() {
    const db = getAdminDb();

    // 1. Fetch precomputed global stats (O(1) read)
    const statsDoc = await db.collection('platform_stats').doc('current').get();
    const defaultStats = {
      users_total: 0,
      events_total: 0,
      revenue: { total: 0 },
      tickets_sold_total: 0,
      pendingReviewsCount: 0,
      activeIncidentsCount: 0,
      liveEvents: 0,
      liveUsers: 0,
      liveHosts: 0,
      liveVenues: 0,
      updatedAt: new Date(0).toISOString(),
    };
    let baseStats = statsDoc.exists ? { ...defaultStats, ...statsDoc.data() } : defaultStats;

    // 2. Detect staleness (> 30 mins)
    const lastSyncDate = new Date(baseStats.updatedAt || 0);
    const staleThresholdMs = 30 * 60 * 1000;
    let isStale = Date.now() - lastSyncDate.getTime() > staleThresholdMs;

    // Auto-compute if stats are missing or stale (especially important for dev local mode)
    if (
      !statsDoc.exists ||
      isStale ||
      baseStats.liveUsers === undefined ||
      baseStats.revenue?.total === undefined ||
      baseStats.hosts_pending === undefined
    ) {
      try {
        console.log('[PlatformStats] Stats are stale or missing. Auto-computing stats...');
        baseStats = await this.computePlatformStats();
        isStale = false;
      } catch (err) {
        console.error('Failed to auto-compute platform stats:', err);
      }
    }

    // 3. Fetch truly transient data that shouldn't be lagged (audit logs)
    const logsSnapshot = await db
      .collection('admin_audit_logs')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();

    const recentLogs = logsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        action: data.action,
        timestamp: data.timestamp?.toDate?.() || new Date(),
        reason: data.reason,
      };
    });

    return {
      stats: baseStats,
      pendingReviewsCount: baseStats.pendingReviewsCount,
      activeIncidentsCount: baseStats.activeIncidentsCount,
      liveEvents: baseStats.liveEvents,
      liveUsers: baseStats.liveUsers || baseStats.users_total || 0,
      liveHosts: baseStats.liveHosts || baseStats.hosts_total || 0,
      liveVenues: baseStats.liveVenues || baseStats.venues_total?.active || 0,
      recentLogs,
      lastSync: baseStats.updatedAt,
      isStale,
    };
  },

  /**
   * Heavy aggregation intended for background execution only.
   * Triggered via cron/worker to update 'platform_stats/current'.
   */
  async computePlatformStats() {
    const db = getAdminDb();
    console.log('[PlatformStats] Starting heavy aggregation...');

    const [
      pendingSnap,
      incidentSnap,
      eventSnap,
      userSnap,
      hostSnap,
      activeVenueSnap,
      suspendedVenueSnap,
      totalEventsSnap,
      pendingVenueOnboardingSnap,
      pendingHostOnboardingSnap,
    ] = await Promise.all([
      db.collection('onboarding_requests').where('status', '==', 'pending').count().get(),
      db.collection('incidents').where('status', '==', 'active').count().get(),
      db.collection('events').where('status', '==', 'live').count().get(),
      db.collection('users').count().get(),
      db.collection('hosts').count().get(),
      db.collection('venues').where('status', '==', 'active').count().get(),
      db.collection('venues').where('status', '==', 'suspended').count().get(),
      db.collection('events').count().get(),
      db
        .collection('onboarding_requests')
        .where('status', '==', 'pending')
        .where('type', '==', 'venue')
        .count()
        .get(),
      db
        .collection('onboarding_requests')
        .where('status', '==', 'pending')
        .where('type', '==', 'host')
        .count()
        .get(),
    ]);

    // Query orders to compute total revenue and tickets sold
    let totalRevenue = 0;
    let ticketsSoldTotal = 0;
    try {
      const ordersSnap = await db.collection('orders').get();
      ordersSnap.forEach((doc) => {
        const order = doc.data();
        if (order.status === 'confirmed' || order.status === 'checked_in') {
          totalRevenue += Number(order.totalAmount) || 0;
          if (Array.isArray(order.tickets)) {
            order.tickets.forEach((ticket) => {
              ticketsSoldTotal += Number(ticket.quantity) || 0;
            });
          }
        }
      });
    } catch (err) {
      console.error('Error scanning orders for revenue calculation:', err);
      throw err;
    }

    const stats = {
      pendingReviewsCount: pendingSnap.data().count,
      activeIncidentsCount: incidentSnap.data().count,
      liveEvents: eventSnap.data().count,
      liveUsers: userSnap.data().count,
      liveHosts: hostSnap.data().count,
      liveVenues: activeVenueSnap.data().count,
      users_total: userSnap.data().count,
      events_total: totalEventsSnap.data().count,
      hosts_total: hostSnap.data().count,
      venues_total: {
        active: activeVenueSnap.data().count,
        pending: pendingVenueOnboardingSnap.data().count,
        suspended: suspendedVenueSnap.data().count,
      },
      hosts_pending: pendingHostOnboardingSnap.data().count,
      revenue: {
        total: totalRevenue,
        ticket_commissions: totalRevenue * 0.15,
        boosts: 0,
        subscriptions: 0,
      },
      tickets_sold_total: ticketsSoldTotal,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('platform_stats').doc('current').set(stats, { merge: true });
    console.log('[PlatformStats] Computed and synced successfully.');
    return stats;
  },

  async getEntitySnapshot(targetId, entityType) {
    if (!targetId) return null;
    const db = getAdminDb();
    const COLLECTION_MAP = {
      user: 'users',
      host: 'hosts',
      venue: 'venues',
      promoter: 'promoters',
      event: 'events',
      order: 'orders',
      admin: 'admins',
      ticket: 'tickets',
      webhook: 'failed_webhooks',
      support_ticket: 'support_tickets',
      safety_report: 'safety_reports',
    };
    const col = COLLECTION_MAP[entityType];
    if (!col) return null;
    const snap = await db.collection(col).doc(targetId).get();
    if (!snap.exists) return null;
    const d = snap.data();
    return { id: snap.id, ...d };
  },

  async appendAuditDelta(
    targetId,
    action,
    adminId,
    { before, after },
    context,
    targetType = 'audit_delta',
    reason = 'State delta captured for audit trail',
  ) {
    await this.logAdminAction({
      adminId,
      action: `${action}:DELTA`,
      targetId,
      targetType,
      reason,
      before,
      after,
      context,
    });
  },

  async dismissMediaReport(reportId, adminId, reason) {
    const db = getAdminDb();
    const ref = db.collection('media_reports').doc(reportId);
    const snap = await ref.get();
    if (!snap.exists) throw Object.assign(new Error('Report not found'), { statusCode: 404 });
    await ref.update({
      status: 'dismissed',
      dismissedAt: FieldValue.serverTimestamp(),
      dismissedBy: adminId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.logAdminAction({
      adminId,
      action: 'MEDIA_REPORT_DISMISS',
      targetId: reportId,
      targetType: 'media_report',
      reason,
    });
  },

  async removeContent(targetId, entityType, adminId, reason) {
    const db = getAdminDb();
    const COLLECTION_MAP = { post: 'posts', comment: 'comments', media: 'media_reports' };
    const col = COLLECTION_MAP[entityType] || 'media_reports';
    await db.collection(col).doc(targetId).update({
      status: 'removed',
      removedAt: FieldValue.serverTimestamp(),
      removedBy: adminId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await this.logAdminAction({
      adminId,
      action: 'CONTENT_REMOVE',
      targetId,
      targetType: entityType || 'content',
      reason,
    });
  },

  async listCollection(collection, { status, limit, adminRole, cursor, sortBy } = {}) {
    const db = getAdminDb();
    let query = db.collection(collection);
    if (status) query = query.where('status', '==', status);
    const ORDER_MAP = {
      admin_audit_logs: ['timestamp', 'desc'],
      events: ['startDate', 'desc'],
      onboarding_requests: ['submittedAt', 'desc'],
    };
    const defaultOrder = ['createdAt', 'desc'];
    const [field, dir] = sortBy ? [sortBy, 'desc'] : ORDER_MAP[collection] || defaultOrder;
    try {
      query = query.orderBy(field, dir);
    } catch (error) {
      console.warn(`[adminStore] Failed to order collection ${collection} by ${field}:`, error);
    }
    if (cursor) {
      const cursorDoc = await db.collection(collection).doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }
    const pageLimit = limit || 50;
    const snapshot = await query.limit(pageLimit + 1).get(); // +1 to detect hasMore
    const docs = snapshot.docs.slice(0, pageLimit);
    const hasMore = snapshot.docs.length > pageLimit;
    const nextCursor = hasMore ? docs[docs.length - 1].id : null;

    const safeDate = (val) => {
      if (!val) return undefined;
      if (typeof val.toDate === 'function') {
        return val.toDate().toISOString();
      }
      if (val instanceof Date) {
        return val.toISOString();
      }
      if (typeof val === 'string') {
        return val;
      }
      if (val.seconds !== undefined) {
        return new Date(val.seconds * 1000).toISOString();
      }
      return undefined;
    };

    const items = docs.map((doc) => {
      const d = doc.data();
      const tsVal = safeDate(d.timestamp) || safeDate(d.ts) || safeDate(d.createdAt);
      return {
        id: doc.id,
        ...d,
        timestamp: tsVal,
        createdAt: safeDate(d.createdAt) || tsVal,
        updatedAt: safeDate(d.updatedAt) || tsVal,
        submittedAt: safeDate(d.submittedAt),
        ts: safeDate(d.ts) || tsVal,
      };
    });
    return items; // backward-compatible: callers that just use the array still work
  },

  async exportCollection(collection, limit = 2000) {
    const db = getAdminDb();
    // Firestore requires: orderBy() BEFORE limit()
    let query = db.collection(collection);
    if (['users', 'orders', 'admin_audit_logs'].includes(collection))
      query = query.orderBy('createdAt', 'desc');
    const snapshot = await query.limit(limit).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  async getLedgerEntries({ entityId, actorId, state, limit = 100 } = {}) {
    const db = getAdminDb();
    // Firestore requires: where() BEFORE orderBy()
    let query = db.collection('ledger_entries');
    if (entityId) query = query.where('entityId', '==', entityId);
    if (actorId) query = query.where('actorId', '==', actorId);
    if (state) query = query.where('state', '==', state);
    query = query.orderBy('timestamp', 'desc');
    const snapshot = await query.limit(limit).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  },

  async getHealthStatus() {
    const db = getAdminDb();
    const results = { database: 'Unknown', audit_pipeline: 'Unknown' };
    await db.collection('admin_audit_config').doc('integrity_state').get();
    results.database = 'Healthy';
    const lastLog = await db
      .collection('admin_audit_logs')
      .orderBy('sequence', 'desc')
      .limit(1)
      .get();
    results.audit_pipeline = lastLog.empty ? 'Empty' : 'Healthy';
    return results;
  },

  // --- 🔍 8. Direct Document Fetch (for lookup by ID) ---
  async getDocumentById(collection, id) {
    const db = getAdminDb();
    const doc = await db.collection(collection).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  },

  async findUserByEmail(email) {
    const db = getAdminDb();
    const snapshot = await db
      .collection('users')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  },

  // --- 💰 9. Refund Request Management ---
  async getRefunds({ status = 'pending', limit = 25, cursor = null } = {}) {
    const db = getAdminDb();
    try {
      // Standard fast query using composite index
      let query = db.collection('refund_requests');
      if (status !== 'all') query = query.where('status', '==', status);
      query = query.orderBy('createdAt', 'desc').limit(limit + 1); // fetch one extra to detect hasMore
      if (cursor) {
        const cursorDoc = await db.collection('refund_requests').doc(cursor).get();
        if (cursorDoc.exists) query = query.startAfter(cursorDoc);
      }
      const snapshot = await query.get();
      const docs = snapshot.docs.slice(0, limit);
      const hasMore = snapshot.docs.length > limit;
      const nextCursor = hasMore ? docs[docs.length - 1].id : null;
      return {
        refunds: docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        hasMore,
        nextCursor,
      };
    } catch (err) {
      // Fallback: If composite index is missing (e.g. FAILED_PRECONDITION), run in-memory fallback
      if (err.message && err.message.includes('FAILED_PRECONDITION')) {
        console.warn(
          '⚠️ Firestore composite index missing. Falling back to in-memory filtering for refund requests.',
        );
        let query = db.collection('refund_requests').orderBy('createdAt', 'desc');
        const snapshot = await query.get();

        let allRefunds = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        if (status !== 'all') {
          allRefunds = allRefunds.filter((r) => r.status === status);
        }

        let startIndex = 0;
        if (cursor) {
          const idx = allRefunds.findIndex((r) => r.id === cursor);
          if (idx !== -1) {
            startIndex = idx + 1;
          }
        }

        const paginated = allRefunds.slice(startIndex, startIndex + limit + 1);
        const docs = paginated.slice(0, limit);
        const hasMore = paginated.length > limit;
        const nextCursor = hasMore ? docs[docs.length - 1].id : null;

        return {
          refunds: docs,
          hasMore,
          nextCursor,
        };
      }
      throw err;
    }
  },

  async approveRefundRequest(refundId, admin) {
    const db = getAdminDb();
    const refundRef = db.collection('refund_requests').doc(refundId);
    let result;
    // Use a transaction to prevent concurrent double-approval race conditions
    await db.runTransaction(async (tx) => {
      const refundDoc = await tx.get(refundRef);
      if (!refundDoc.exists) throw new Error('Refund request not found');
      const refundData = refundDoc.data();
      if (refundData.status !== 'pending')
        throw new Error(`Refund is already ${refundData.status}`);
      if (refundData.approvers?.some((a) => a.uid === admin.uid))
        throw new Error('You have already approved this refund');
      const now = new Date().toISOString();
      const newApprovers = [
        ...(refundData.approvers || []),
        { uid: admin.uid, name: admin.name || admin.email, role: admin.role, at: now },
      ];
      const isFullyApproved = newApprovers.length >= (refundData.approversRequired || 1);
      tx.update(refundRef, {
        approvers: newApprovers,
        status: isFullyApproved ? 'approved' : 'pending',
        updatedAt: now,
        ...(isFullyApproved && { approvedAt: now }),
      });
      if (isFullyApproved)
        tx.update(db.collection('orders').doc(refundData.orderId), {
          status: 'refunded',
          refundedAt: now,
          refundAmount: refundData.amount,
        });
      result = {
        isFullyApproved,
        pendingApprovals: isFullyApproved ? 0 : refundData.approversRequired - newApprovers.length,
        orderId: refundData.orderId,
        amount: refundData.amount,
      };
    });
    await this.logAdminAction({
      action: 'refund_approved',
      targetType: 'refund_request',
      targetId: refundId,
      adminId: admin.uid,
      reason: 'Admin approval',
      after: {
        orderId: result.orderId,
        amount: result.amount,
        fullyApproved: result.isFullyApproved,
      },
    });
    return { isFullyApproved: result.isFullyApproved, pendingApprovals: result.pendingApprovals };
  },

  async rejectRefundRequest(refundId, reason, admin) {
    const db = getAdminDb();
    const refundRef = db.collection('refund_requests').doc(refundId);
    const refundDoc = await refundRef.get();
    if (!refundDoc.exists) throw new Error('Refund request not found');
    const refundData = refundDoc.data();
    if (refundData.status !== 'pending') throw new Error(`Refund is already ${refundData.status}`);
    const now = new Date().toISOString();
    const batch = db.batch();
    batch.update(refundRef, {
      status: 'rejected',
      rejectedBy: { uid: admin.uid, name: admin.name || admin.email, role: admin.role },
      rejectionReason: reason,
      rejectedAt: now,
      updatedAt: now,
    });
    batch.update(db.collection('orders').doc(refundData.orderId), {
      status: 'confirmed',
      refundRejected: true,
      refundRejectionReason: reason,
      updatedAt: now,
    });
    await batch.commit();
    await this.logAdminAction({
      action: 'refund_rejected',
      targetType: 'refund_request',
      targetId: refundId,
      adminId: admin.uid,
      reason,
      after: { orderId: refundData.orderId, amount: refundData.amount },
    });
  },
};
