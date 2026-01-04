import { getAdminDb } from "../firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * THE C1RCLE - Admin Governance Store (Hardened)
 * - Strict Action Allowlist
 * - State Transition Enforcement
 * - Input Validation & Rate Limiting
 */

// Task 4: Simple In-Memory Rate Limiting
const ACTION_LIMITS = new Map(); // uid -> { count, lastReset }
const TIER2_LIMITS = new Map(); // uid -> { count, lastReset }

const MAX_ACTIONS_PER_MINUTE = 15;
const MAX_TIER2_PER_MINUTE = 5;

function checkRateLimit(adminId, isTier2 = false) {
    const now = Date.now();

    // Tier 1 / General
    const limit = ACTION_LIMITS.get(adminId) || { count: 0, lastReset: now };
    if (now - limit.lastReset > 60000) {
        limit.count = 0;
        limit.lastReset = now;
    }
    if (limit.count >= MAX_ACTIONS_PER_MINUTE) {
        throw new Error("Rate limit exceeded. Too many administrative actions.");
    }
    limit.count++;
    ACTION_LIMITS.set(adminId, limit);

    // Tier 2 Specific
    if (isTier2) {
        const t2limit = TIER2_LIMITS.get(adminId) || { count: 0, lastReset: now };
        if (now - t2limit.lastReset > 60000) {
            t2limit.count = 0;
            t2limit.lastReset = now;
        }
        if (t2limit.count >= MAX_TIER2_PER_MINUTE) {
            throw new Error("Restricted Action Rate Limit Exceeded. Tier 2 actions are limited to 5/min.");
        }
        t2limit.count++;
        TIER2_LIMITS.set(adminId, t2limit);
    }
}

// Task 2: Explicit Action Allowlist
export const ALLOWLIST_ACTIONS = [
    'VENUE_ACTIVATE', 'VENUE_SUSPEND', 'VENUE_REINSTATE',
    'HOST_APP_APPROVE', 'HOST_APP_REJECT',
    'EVENT_PAUSE', 'EVENT_RESUME',
    'USER_BAN', 'USER_UNBAN',
    'ORDER_REFUND_REQUEST',

    // --- 🧭 PHASE 2: TIER 1 ACTIONS ---
    'DISCOVERY_WEIGHT_ADJUST',
    'VERIFICATION_ISSUE', 'VERIFICATION_REVOKE',
    'WARNING_ISSUE',

    // --- 🏦 PHASE 4: TIER 3 ACTIONS ---
    'IDENTITY_SUSPEND', 'IDENTITY_REINSTATE',
    'FINANCIAL_REFUND',
    'COMMISSION_ADJUST',
    'PAYOUT_FREEZE', 'PAYOUT_RELEASE'
];

export const TIER2_ACTIONS = ['EVENT_PAUSE', 'EVENT_RESUME', 'VENUE_SUSPEND', 'VENUE_REINSTATE'];
export const TIER3_ACTIONS = ['IDENTITY_SUSPEND', 'IDENTITY_REINSTATE', 'FINANCIAL_REFUND', 'COMMISSION_ADJUST', 'PAYOUT_FREEZE', 'PAYOUT_RELEASE'];

// Financial-sensitive actions (require Finance Admin + Super Admin)
const FINANCIAL_AUTHORITY_REQUIRED = ['FINANCIAL_REFUND', 'COMMISSION_ADJUST', 'PAYOUT_FREEZE', 'PAYOUT_RELEASE'];

export const adminStore = {
    async checkContainment() {
        // Technical Design: Emergency Freeze infrastructure
        // Checks platform settings for mutation lockdown
        const db = getAdminDb();
        const settings = await db.collection('platform_settings').doc('governance').get();
        if (settings.exists && settings.data().actionFreeze === true) {
            throw new Error("Containment Active: Administrative mutations are temporarily frozen via Super Admin kill-switch.");
        }
    },

    // --- 🏛️ HELPER: Immutable Logging ---
    async logAction({ adminId, action, targetId, targetType, reason, evidence = null, before = null, after = null }) {
        await this.checkContainment(); // Prevent even logging/initiating during freeze
        const isTier2 = TIER2_ACTIONS.includes(action);
        const isTier3 = TIER3_ACTIONS.includes(action);
        const minReason = (isTier2 || isTier3) ? 20 : 5;

        if (!reason || reason.trim().length < minReason) {
            throw new Error(`Audit reason is mandatory (min ${minReason} chars for this priority level).`);
        }

        if ((isTier2 || isTier3) && !evidence) {
            throw new Error(`Protocol Error: Reference evidence (link) is required for Tier ${isTier3 ? 3 : 2} actions.`);
        }

        // Safety: Self-targeting prohibition
        if (adminId === targetId) {
            throw new Error("Safety Violation: Self-targeting administrative actions are strictly forbidden.");
        }

        checkRateLimit(adminId, isTier2 || isTier3);

        const db = getAdminDb();
        return await db.collection('admin_logs').add({
            adminId,
            action,
            targetId,
            targetType,
            reason,
            evidence,
            before,
            after,
            timestamp: FieldValue.serverTimestamp()
        });
    },

    // --- 🗳️ DUAL APPROVAL FRAMEWORK ---
    async proposeAction(adminId, adminRole, actionData) {
        await this.checkContainment();
        const db = getAdminDb();
        const { action, targetId, targetType, reason, evidence, params } = actionData;

        // Basic validation before proposing
        if (!ALLOWLIST_ACTIONS.includes(action)) throw new Error("Proposed action not in allowlist.");

        const isTier3 = TIER3_ACTIONS.includes(action);
        const coolingPeriodMinutes = isTier3 ? 120 : 0;
        const now = new Date();
        const coolingPeriodEnd = isTier3 ? new Date(now.getTime() + coolingPeriodMinutes * 60000) : null;

        return await db.collection('admin_proposed_actions').add({
            proposerId: adminId,
            proposerRole: adminRole,
            action,
            targetId,
            targetType,
            reason,
            evidence,
            params,
            status: 'pending',
            coolingPeriodEnd: coolingPeriodEnd ? FieldValue.serverTimestamp() : null, // Not quite, using Date for logic below
            createdAt: FieldValue.serverTimestamp(),
            executionWindowStart: coolingPeriodEnd ? coolingPeriodEnd.toISOString() : null
        });
    },

    async resolveProposal(proposalId, reviewerId, reviewerRole, status, rejectionReason = null) {
        await this.checkContainment();
        const db = getAdminDb();
        const propRef = db.collection('admin_proposed_actions').doc(proposalId);
        const propSnap = await propRef.get();

        if (!propSnap.exists) throw new Error("Governance Error: Proposal reference not found.");
        const proposal = propSnap.data();

        if (proposal.status !== 'pending') throw new Error("Governance Error: Proposal already processed.");

        if (proposal.proposerId === reviewerId) {
            throw new Error("Conflict of Interest: Dual-approval protocol forbids self-approval.");
        }

        const isTier3 = TIER3_ACTIONS.includes(proposal.action);

        // --- 🛡️ TIER 3 GOVERNANCE CHECKS ---
        if (isTier3) {
            // 1. Role Silo Enforcement
            if (proposal.proposerRole === reviewerRole) {
                throw new Error("Role Silo Breach: Tier 3 actions require approval from a different administrative role.");
            }

            // 2. Cooling Period Enforcement
            if (proposal.executionWindowStart) {
                const waitTime = new Date(proposal.executionWindowStart) - new Date();
                if (waitTime > 0 && status === 'approved') {
                    throw new Error(`Cooling Period Active: This high-risk action remains frozen for another ${Math.ceil(waitTime / 60000)} minutes.`);
                }
            }

            // 3. Financial Role Requirements
            if (FINANCIAL_AUTHORITY_REQUIRED.includes(proposal.action)) {
                const roles = [proposal.proposerRole, reviewerRole];
                if (!roles.includes('super') || !roles.includes('finance')) {
                    throw new Error("Financial Authority Missing: This action requires dual sign-off from both a Super Admin and a Finance Admin.");
                }
            }
        }

        if (status === 'approved') {
            // EXECUTION HUB: Dispatch based on proposed action
            switch (proposal.action) {
                case 'EVENT_PAUSE':
                    await this.setEventStatus(proposal.targetId, 'pause', reviewerId, `[DUAL_APPROVED] ${proposal.reason}`, proposal.evidence);
                    break;
                case 'EVENT_RESUME':
                    await this.setEventStatus(proposal.targetId, 'resume', reviewerId, `[DUAL_APPROVED] ${proposal.reason}`, proposal.evidence);
                    break;
                case 'VENUE_SUSPEND':
                    await this.updateVenueStatus(proposal.targetId, 'suspended', reviewerId, `[DUAL_APPROVED] ${proposal.reason}`, proposal.evidence);
                    break;
                case 'VENUE_REINSTATE':
                    await this.updateVenueStatus(proposal.targetId, 'reinstated', reviewerId, `[DUAL_APPROVED] ${proposal.reason}`, proposal.evidence);
                    break;

                // --- TIER 3 DISPATCH ---
                case 'IDENTITY_SUSPEND':
                    await this.identityIntervention(proposal.targetId, true, reviewerId, proposal.reason, proposal.evidence);
                    break;
                case 'IDENTITY_REINSTATE':
                    await this.identityIntervention(proposal.targetId, false, reviewerId, proposal.reason, proposal.evidence);
                    break;
                case 'FINANCIAL_REFUND':
                    await this.financialRefund(proposal.targetId, reviewerId, proposal.reason, proposal.evidence, proposal.params);
                    break;
                case 'COMMISSION_ADJUST':
                    await this.commissionAdjust(proposal.targetId, proposal.targetType, proposal.params.rate, reviewerId, proposal.reason, proposal.evidence);
                    break;
                case 'PAYOUT_FREEZE':
                    await this.payoutIntervention(proposal.targetId, proposal.targetType, true, reviewerId, proposal.reason, proposal.evidence);
                    break;
                case 'PAYOUT_RELEASE':
                    await this.payoutIntervention(proposal.targetId, proposal.targetType, false, reviewerId, proposal.reason, proposal.evidence);
                    break;

                default:
                    throw new Error("Governance Error: Proposed action dispatcher not implemented.");
            }
        }

        await propRef.update({
            status,
            reviewerId,
            reviewerRole,
            rejectionReason,
            resolvedAt: FieldValue.serverTimestamp()
        });

        // Final Log for the Resolution itself
        await this.logAction({
            adminId: reviewerId,
            action: `PROPOSAL_${status.toUpperCase()}`,
            targetId: proposalId,
            targetType: 'proposal',
            reason: status === 'approved' ? "Dual approval threshold met." : (rejectionReason || "Declined by secondary reviewer."),
            before: { status: 'pending' },
            after: { status }
        });
    },

    // --- 🏢 1. Venue Management ---
    async updateVenueStatus(venueId, status, adminId, reason, evidence = null) {
        const db = getAdminDb();
        const venueRef = db.collection('venues').doc(venueId);
        const snapshot = await venueRef.get();

        if (!snapshot.exists) throw new Error("Venue not found");
        const before = snapshot.data();

        // State Transition Safety
        if (before.status === status) return;

        // Tier 2: Suspension logic
        if (status === 'suspended') {
            const batch = db.batch();
            batch.update(venueRef, {
                status: 'suspended',
                updatedAt: FieldValue.serverTimestamp()
            });

            // Propagate to associated events: Under Review
            const events = await db.collection('events').where('venueId', '==', venueId).where('status', '==', 'live').get();
            events.forEach(doc => {
                batch.update(doc.ref, {
                    status: 'under_review',
                    adminOverride: true,
                    updatedAt: FieldValue.serverTimestamp()
                });
            });

            await batch.commit();
        } else if (status === 'active' || status === 'reinstated') {
            // Guard: Cannot reinstate if there are unresolved flags
            if ((before.unresolvedFlagsCount || 0) > 0) {
                throw new Error("Governance Guard: Venue has unresolved compliance flags. Clear flags before reinstatement.");
            }

            await venueRef.update({
                status: 'active',
                updatedAt: FieldValue.serverTimestamp()
            });
        }

        await this.logAction({
            adminId,
            action: status === 'active' || status === 'reinstated' ? 'VENUE_REINSTATE' : `VENUE_${status.toUpperCase()}`,
            targetId: venueId,
            targetType: 'venue',
            reason,
            evidence,
            before: { status: before.status },
            after: { status: status === 'reinstated' ? 'active' : status }
        });
    },

    // --- 📝 2. Host Management ---
    async updateHostApplication(applicationId, status, adminId, reason) {
        const db = getAdminDb();
        const appRef = db.collection('host_applications').doc(applicationId);
        const snapshot = await appRef.get();

        if (!snapshot.exists) throw new Error("Application not found");
        const appData = snapshot.data();

        if (['approved', 'rejected'].includes(appData.status)) {
            throw new Error("Cannot modify host application in a terminal state.");
        }

        const batch = db.batch();
        batch.update(appRef, { status, updatedAt: FieldValue.serverTimestamp() });

        if (status === 'approved') {
            batch.update(db.collection('users').doc(appData.uid), {
                role: 'host',
                hostStatus: 'approved',
                updatedAt: FieldValue.serverTimestamp()
            });
        }

        await batch.commit();

        await this.logAction({
            adminId,
            action: `HOST_APP_${status.toUpperCase()}`,
            targetId: applicationId,
            targetType: 'host_application',
            reason,
            before: { status: appData.status },
            after: { status }
        });
    },

    // --- 🎉 3. Event Governance ---
    async setEventStatus(eventId, status, adminId, reason, evidence = null) {
        const db = getAdminDb();
        const eventRef = db.collection('events').doc(eventId);
        const snapshot = await eventRef.get();

        if (!snapshot.exists) throw new Error("Event not found");
        const before = snapshot.data();

        // Tier 2: Guard against completed events
        if (before.status === 'completed' || before.status === 'past') {
            throw new Error("Safety Violation: Cannot pause/resume a completed or past event.");
        }

        const targetStatus = status === 'pause' ? 'paused' : 'live';
        if (before.status === targetStatus) return;

        await eventRef.update({
            status: targetStatus,
            adminOverride: targetStatus === 'paused',
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAction({
            adminId,
            action: targetStatus === 'paused' ? 'EVENT_PAUSE' : 'EVENT_RESUME',
            targetId: eventId,
            targetType: 'event',
            reason,
            evidence,
            before: { status: before.status, adminOverride: before.adminOverride },
            after: { status: targetStatus, adminOverride: targetStatus === 'paused' }
        });
    },

    // --- 🛡️ 4. User Governance ---
    async setUserBanStatus(userId, isBanned, adminId, reason) {
        const db = getAdminDb();
        const userRef = db.collection('users').doc(userId);
        const snapshot = await userRef.get();

        if (!snapshot.exists) throw new Error("User not found");
        const before = snapshot.data();

        if (before.role === 'admin') {
            throw new Error("Privilege Violation: Use Super Admin console to revoke admin status.");
        }

        await userRef.update({
            isBanned,
            bannedAt: isBanned ? FieldValue.serverTimestamp() : null,
            banReason: isBanned ? reason : null,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAction({
            adminId,
            action: isBanned ? 'USER_BAN' : 'USER_UNBAN',
            targetId: userId,
            targetType: 'user',
            reason,
            before: { isBanned: before.isBanned || false },
            after: { isBanned }
        });
    },

    // --- 🧭 6. Tier 1: Discovery & Verification ---

    async setDiscoveryWeight(type, targetId, weight, adminId, reason) {
        const db = getAdminDb();
        const collection = type === 'event' ? 'events' : (type === 'venue' ? 'venues' : 'users');
        const docRef = db.collection(collection).doc(targetId);
        const snapshot = await docRef.get();

        if (!snapshot.exists) throw new Error(`${type} not found`);
        const before = snapshot.data();

        const numericWeight = parseFloat(weight);
        if (isNaN(numericWeight) || numericWeight < -10 || numericWeight > 50) {
            throw new Error("Weight out of bounds (-10 to 50).");
        }

        await docRef.update({
            discoveryWeight: numericWeight,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAction({
            adminId,
            action: 'DISCOVERY_WEIGHT_ADJUST',
            targetId,
            targetType: type,
            reason,
            before: { discoveryWeight: before.discoveryWeight || 0 },
            after: { discoveryWeight: numericWeight }
        });
    },

    async setVerificationStatus(type, targetId, isVerified, adminId, reason) {
        const db = getAdminDb();
        const collection = type === 'venue' ? 'venues' : 'users';
        const docRef = db.collection(collection).doc(targetId);
        const snapshot = await docRef.get();

        if (!snapshot.exists) throw new Error(`${type} not found`);
        const before = snapshot.data();

        await docRef.update({
            isVerified,
            verifiedAt: isVerified ? FieldValue.serverTimestamp() : null,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAction({
            adminId,
            action: isVerified ? 'VERIFICATION_ISSUE' : 'VERIFICATION_REVOKE',
            targetId,
            targetType: type,
            reason,
            before: { isVerified: before.isVerified || false },
            after: { isVerified }
        });
    },

    async issueWarning(type, targetId, message, adminId, reason) {
        const db = getAdminDb();
        const collection = type === 'event' ? 'events' : (type === 'venue' ? 'venues' : 'users');
        const docRef = db.collection(collection).doc(targetId);
        const snapshot = await docRef.get();

        if (!snapshot.exists) throw new Error(`${type} not found`);

        await docRef.update({
            warnings: FieldValue.arrayUnion({
                message,
                adminId,
                timestamp: new Date().toISOString(),
                auditReason: reason
            }),
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAction({
            adminId,
            action: 'WARNING_ISSUE',
            targetId,
            targetType: type,
            reason,
            before: { warningCount: (snapshot.data().warnings || []).length },
            after: { warningCount: (snapshot.data().warnings || []).length + 1, message }
        });
    },

    // --- 🏦 TIER 3: POWER ACTIONS ---

    async identityIntervention(userId, isBanned, adminId, reason, evidence) {
        const db = getAdminDb();
        const userRef = db.collection('users').doc(userId);
        const snapshot = await userRef.get();

        if (!snapshot.exists) throw new Error("Identity Error: User account not found.");
        const before = snapshot.data();

        if (before.role === 'admin' && isBanned) {
            throw new Error("Tier 3 Violation: Admin accounts cannot be suspended via standard identity pipeline.");
        }

        await userRef.update({
            isBanned,
            tier3Control: isBanned,
            bannedAt: isBanned ? FieldValue.serverTimestamp() : null,
            banReason: isBanned ? reason : null,
            banEvidence: isBanned ? evidence : null,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAction({
            adminId,
            action: isBanned ? 'IDENTITY_SUSPEND' : 'IDENTITY_REINSTATE',
            targetId: userId,
            targetType: 'user',
            reason,
            evidence,
            before: { isBanned: before.isBanned || false, tier3: before.tier3Control || false },
            after: { isBanned, tier3: isBanned }
        });
    },

    async financialRefund(orderId, adminId, reason, evidence, params) {
        const db = getAdminDb();
        const orderRef = db.collection('orders').doc(orderId);
        const snapshot = await orderRef.get();

        if (!snapshot.exists) throw new Error("Financial Error: Order record not found.");
        const order = snapshot.data();

        // Idempotency & State Guard
        if (order.status === 'refunded') throw new Error("Protocol Violation: Order is already in a terminal REFUNDED state.");
        if (order.paymentStatus !== 'captured') throw new Error("Gateway Error: Only settled/captured transactions can be reversed.");

        // Execution (Simulated gateway bridge for this task)
        await orderRef.update({
            status: 'refunded',
            refundedAt: FieldValue.serverTimestamp(),
            adminRefundId: adminId,
            refundReason: reason,
            refundEvidence: evidence,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAction({
            adminId,
            action: 'FINANCIAL_REFUND',
            targetId: orderId,
            targetType: 'order',
            reason,
            evidence,
            before: { status: order.status, paymentStatus: order.paymentStatus },
            after: { status: 'refunded', paymentStatus: 'refunded' }
        });
    },

    async commissionAdjust(targetId, targetType, rate, adminId, reason, evidence) {
        const db = getAdminDb();
        const collection = targetType === 'venue' ? 'venues' : 'users';
        const docRef = db.collection(collection).doc(targetId);
        const snapshot = await docRef.get();

        if (!snapshot.exists) throw new Error(`${targetType} record not found.`);
        const before = snapshot.data();

        const numericRate = parseFloat(rate);
        if (isNaN(numericRate) || numericRate < 0 || numericRate > 100) {
            throw new Error("Contract Violation: Commission rate must be between 0 and 100.");
        }

        await docRef.update({
            platformFeeRate: numericRate,
            commissionUpdatedAt: FieldValue.serverTimestamp(),
            commissionUpdatedBy: adminId,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAction({
            adminId,
            action: 'COMMISSION_ADJUST',
            targetId,
            targetType,
            reason,
            evidence,
            before: { platformFeeRate: before.platformFeeRate || 0 },
            after: { platformFeeRate: numericRate }
        });
    },

    async payoutIntervention(targetId, targetType, isFrozen, adminId, reason, evidence) {
        const db = getAdminDb();
        const collection = targetType === 'venue' ? 'venues' : 'users';
        const docRef = db.collection(collection).doc(targetId);
        const snapshot = await docRef.get();

        if (!snapshot.exists) throw new Error(`${targetType} record not found.`);
        const before = snapshot.data();

        const payoutStatus = isFrozen ? 'frozen' : 'active';

        await docRef.update({
            payoutStatus,
            payoutStatusUpdatedAt: FieldValue.serverTimestamp(),
            payoutStatusEvidence: evidence,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAction({
            adminId,
            action: isFrozen ? 'PAYOUT_FREEZE' : 'PAYOUT_RELEASE',
            targetId,
            targetType,
            reason,
            evidence,
            before: { payoutStatus: before.payoutStatus || 'active' },
            after: { payoutStatus }
        });
    }
};
