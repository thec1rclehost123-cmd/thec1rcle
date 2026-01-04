import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// Authority Tiering
export const TIER1_ACTIONS = [
    'DISCOVERY_WEIGHT_ADJUST', 'VERIFICATION_ISSUE', 'VERIFICATION_REVOKE',
    'WARNING_ISSUE', 'CONTENT_REMOVE', 'EVENT_PAUSE', 'EVENT_RESUME'
];

export const ALLOWLIST_ACTIONS = [
    ...TIER1_ACTIONS,
    'ONBOARDING_APPROVE', 'ONBOARDING_REJECT', 'ONBOARDING_REQUEST_CHANGES',
    'EVENT_PUBLISH', 'EVENT_CANCEL',
    'VENUE_SUSPEND', 'VENUE_REINSTATE',
    'HOST_APP_APPROVE', 'HOST_APP_REJECT',
    'USER_BAN', 'USER_UNBAN', 'USER_WARN',
    'FINANCIAL_REFUND', 'PARTIAL_REFUND',
    'COMMISSION_ADJUST', 'FEE_RULE_UPDATE',
    'PAYOUT_FREEZE', 'PAYOUT_RELEASE', 'PAYOUT_BATCH_RUN',
    'ADMIN_ROLE_UPDATE', 'ADMIN_ACCESS_REVOKE'
];

export const TIER2_ACTIONS = [
    'ONBOARDING_APPROVE', 'VENUE_SUSPEND', 'VENUE_REINSTATE',
    'USER_BAN', 'FINANCIAL_REFUND', 'PAYOUT_BATCH_RUN'
];

export const TIER3_ACTIONS = [
    'ADMIN_PROVISION', 'ADMIN_ACCESS_REVOKE', 'COMMISSION_ADJUST', 'PAYOUT_FREEZE', 'IDENTITY_SUSPEND', 'IDENTITY_REINSTATE'
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

        // Tier 2 usually requires Ops or Super
        if (TIER2_ACTIONS.includes(action) && role === 'moderator') {
            throw new Error(`Authority Error: ${action} requires Tier 2 (Ops) clearance.`);
        }

        return true;
    },

    async proposeAction(adminId, role, { action, targetId, targetType, reason, evidence, params }, context) {
        const db = getAdminDb();
        const proposalId = `prop_${Date.now()}_${Math.random().toString(36).slice(-4)}`;

        const proposal = {
            id: proposalId,
            action,
            targetId,
            targetType,
            reason: reason || "",
            evidence: evidence || null,
            params: params || {},
            proposerId: adminId,
            proposerRole: role,
            status: 'pending',
            createdAt: FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h lookup
            context: {
                ...(context || {}),
                riskScore: TIER3_ACTIONS.includes(action) ? 90 : 60
            }
        };

        await db.collection('proposed_actions').doc(proposalId).set(proposal);
        await this.logAdminAction({
            adminId,
            adminRole: role,
            action: 'AUTHORITY_PROPOSED',
            targetId: proposalId,
            targetType: 'proposal',
            reason: `Proposed ${action} for ${targetId}`
        });

        return proposalId;
    },

    async resolveProposal(proposalId, resolverId, resolverRole, status, resolutionReason, context) {
        const db = getAdminDb();
        const propRef = db.collection('proposed_actions').doc(proposalId);

        return await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(propRef);
            if (!snapshot.exists) throw new Error("Proposal not found.");
            const proposal = snapshot.data();

            if (proposal.status !== 'pending') {
                return { alreadyProcessed: true, status: proposal.status };
            }

            if (proposal.proposerId === resolverId) {
                throw new Error("Governance Violation: Proposer cannot resolve their own authority request (Dual-Control Policy).");
            }

            transaction.update(propRef, {
                status,
                resolverId,
                resolverRole,
                resolutionReason,
                resolvedAt: FieldValue.serverTimestamp()
            });

            if (status === 'approved') {
                // Execute the actual action
                await this.executeAction(proposal.action, proposal.targetId, proposal.params, resolverId, proposal.reason, proposal.evidence, context);
            }

            await this.logAdminAction({
                adminId: resolverId,
                action: status === 'approved' ? 'AUTHORITY_GRANTED' : 'AUTHORITY_DENIED',
                targetId: proposalId,
                targetType: 'proposal',
                reason: resolutionReason || `Proposal ${status}`
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
                await this.payoutIntervention(targetId, params.type, true, adminId, reason, evidence);
                break;
            case 'VENUE_SUSPEND':
                await this.updateVenueStatus(targetId, 'suspended', adminId, reason, evidence, context);
                break;
            case 'FINANCIAL_REFUND':
                await this.financialRefund(targetId, adminId, reason, evidence, params);
                break;
            default:
                throw new Error(`Execution Dispatch Error: ${action} is not yet mapped for transactional resolution.`);
        }
    },

    // --- 🛂 1. Onboarding & Approval ---
    async approveOnboarding(requestId, adminId, adminRole, reason, context) {
        const db = getAdminDb();
        const auth = getAdminAuth();
        const requestRef = db.collection('onboarding_requests').doc(requestId);

        return await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(requestRef);
            if (!snapshot.exists) throw new Error("Onboarding request not found.");
            const request = snapshot.data();
            const { uid, type, data } = request;
            const now = FieldValue.serverTimestamp();

            if (request.status === 'approved') return { success: true };

            // 1. Update Request Status
            transaction.update(requestRef, {
                status: 'approved',
                reviewedAt: now,
                reviewerId: adminId,
                updatedAt: now
            });

            // 2. Provision Entity in siloed collection
            let partnerId = "";
            let partnerType = "";
            let partnerRole = "OWNER";

            if (type === 'club') {
                partnerId = `venue_${uid.substring(0, 8)}`;
                partnerType = 'club';
                const venueRef = db.collection('venues').doc(partnerId);
                transaction.set(venueRef, {
                    id: partnerId,
                    name: data.name,
                    city: data.city,
                    area: data.area,
                    capacity: data.capacity,
                    ownerUid: uid,
                    status: 'active',
                    tier: data.plan === 'diamond' ? 'premium' : 'standard',
                    platformFeeRate: data.plan === 'basic' ? 15 : (data.plan === 'silver' ? 12 : 10),
                    subscriptionPlan: data.plan,
                    createdAt: now,
                    updatedAt: now,
                    isVerified: true
                });
            } else if (type === 'host') {
                partnerId = `host_${uid.substring(0, 8)}`;
                partnerType = 'host';
                const hostRef = db.collection('hosts').doc(partnerId);
                transaction.set(hostRef, {
                    id: partnerId,
                    name: data.name,
                    role: data.role,
                    ownerUid: uid,
                    status: 'active',
                    isVerified: true,
                    createdAt: now,
                    updatedAt: now
                });
            } else if (type === 'promoter') {
                partnerId = `promoter_${uid.substring(0, 8)}`;
                partnerType = 'promoter';
                partnerRole = 'PROMOTER';
                const promoterRef = db.collection('promoters').doc(partnerId);
                transaction.set(promoterRef, {
                    id: partnerId,
                    name: data.name,
                    ownerUid: uid,
                    status: 'active',
                    createdAt: now,
                    updatedAt: now
                });
            }

            // 3. Set Custom Claims for Dashboard Access (Context-Bound Authority)
            const existingClaims = (await auth.getUser(uid)).customClaims || {};
            await auth.setCustomUserClaims(uid, {
                ...existingClaims,
                partnerId,
                partnerType,
                partnerRole
            });

            // 4. Update Identity Protocol (Signal Approval to Dashboard)
            transaction.update(db.collection('users').doc(uid), {
                isApproved: true,
                role: partnerType === 'club' ? 'partner' : partnerType,
                updatedAt: now
            });

            // 5. Create Membership Record for context mapping
            const membershipRef = db.collection('partner_memberships').doc(`${uid}_${partnerId}`);
            transaction.set(membershipRef, {
                uid,
                partnerId,
                partnerType,
                role: partnerRole,
                status: 'active',
                createdAt: now,
                updatedAt: now
            });

            await this.logAdminAction({
                adminId,
                adminRole,
                action: 'ONBOARDING_APPROVE',
                targetId: requestId,
                targetType: 'onboarding_request',
                reason,
                context,
                after: { status: 'approved', partnerId, partnerType }
            });

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
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAdminAction({
            adminId,
            adminRole,
            action: 'ONBOARDING_REJECT',
            targetId: requestId,
            targetType: 'onboarding_request',
            reason,
            context,
            after: { status: 'rejected' }
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
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAdminAction({
            adminId,
            adminRole,
            action: 'ONBOARDING_REQUEST_CHANGES',
            targetId: requestId,
            targetType: 'onboarding_request',
            reason,
            context,
            after: { status: 'changes_requested' }
        });
    },

    // --- 🎉 2. Event Governance ---
    async setEventStatus(eventId, status, adminId, reason, evidence = null) {
        const db = getAdminDb();
        const eventRef = db.collection('events').doc(eventId);
        const snapshot = await eventRef.get();

        if (!snapshot.exists) throw new Error("Event not found");
        const before = snapshot.data();

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

        await this.logAdminAction({
            adminId,
            adminRole: null, // Global event status change might lack role in this context
            action: targetStatus === 'paused' ? 'EVENT_PAUSE' : 'EVENT_RESUME',
            targetId: eventId,
            targetType: 'event',
            reason,
            evidence: evidence || null,
            before: { status: before.status },
            after: { status: targetStatus }
        });
    },

    // --- 🛡️ 3. User Governance (Consumer context) ---
    async setUserBanStatus(userId, isBanned, adminId, reason) {
        const db = getAdminDb();
        const userRef = db.collection('users').doc(userId);
        const snapshot = await userRef.get();

        if (!snapshot.exists) throw new Error("User record not found.");
        const before = snapshot.data();

        await userRef.update({
            isBanned,
            bannedAt: isBanned ? FieldValue.serverTimestamp() : null,
            banReason: isBanned ? reason : null,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAdminAction({
            adminId,
            action: isBanned ? 'USER_BAN' : 'USER_UNBAN',
            targetId: userId,
            targetType: 'user',
            reason,
            before: { isBanned: before.isBanned || false },
            after: { isBanned }
        });
    },

    // --- 🧭 4. Discovery & Verification ---
    async setDiscoveryWeight(type, targetId, weight, adminId, reason) {
        const db = getAdminDb();
        const collection = type === 'event' ? 'events' : (type === 'venue' ? 'venues' : (type === 'host' ? 'hosts' : 'users'));
        const docRef = db.collection(collection).doc(targetId);

        const numericWeight = parseFloat(weight);
        if (isNaN(numericWeight) || numericWeight < -10 || numericWeight > 50) {
            throw new Error("Weight out of bounds (-10 to 50).");
        }

        await docRef.update({
            discoveryWeight: numericWeight,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAdminAction({
            adminId,
            action: 'DISCOVERY_WEIGHT_ADJUST',
            targetId,
            targetType: type,
            reason,
            after: { discoveryWeight: numericWeight }
        });
    },

    async setVerificationStatus(type, targetId, isVerified, adminId, reason) {
        const db = getAdminDb();
        const collection = type === 'venue' ? 'venues' : (type === 'host' ? 'hosts' : 'users');
        const docRef = db.collection(collection).doc(targetId);

        await docRef.update({
            isVerified,
            verifiedAt: isVerified ? FieldValue.serverTimestamp() : null,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAdminAction({
            adminId,
            action: isVerified ? 'VERIFICATION_ISSUE' : 'VERIFICATION_REVOKE',
            targetId,
            targetType: type,
            reason,
            after: { isVerified }
        });
    },

    async issueWarning(type, targetId, message, adminId, reason) {
        const db = getAdminDb();
        const collection = type === 'event' ? 'events' : (type === 'venue' ? 'venues' : 'users');
        const docRef = db.collection(collection).doc(targetId);

        await docRef.update({
            warnings: FieldValue.arrayUnion({
                message,
                adminId,
                timestamp: new Date().toISOString(),
                auditReason: reason
            }),
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAdminAction({
            adminId,
            action: 'WARNING_ISSUE',
            targetId,
            targetType: type,
            reason,
            after: { warningMessage: message }
        });
    },

    // --- 🏦 5. Financial & Power Actions (Tier 3) ---
    async financialRefund(orderId, adminId, reason, evidence, params) {
        const db = getAdminDb();
        const orderRef = db.collection('orders').doc(orderId);

        return await db.runTransaction(async (transaction) => {
            const snapshot = await transaction.get(orderRef);
            if (!snapshot.exists) throw new Error("Order not found.");
            const order = snapshot.data();

            if (order.status === 'refunded') return { success: true };

            transaction.update(orderRef, {
                status: 'refunded',
                refundedAt: FieldValue.serverTimestamp(),
                refundReason: reason,
                updatedAt: FieldValue.serverTimestamp()
            });

            await this.logAdminAction({
                adminId,
                action: 'FINANCIAL_REFUND',
                targetId: orderId,
                targetType: 'order',
                reason,
                evidence,
                after: { status: 'refunded' }
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
            throw new Error("Invalid commission rate.");
        }

        await docRef.update({
            platformFeeRate: numericRate,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAdminAction({
            adminId,
            action: 'COMMISSION_ADJUST',
            targetId,
            targetType,
            reason,
            evidence,
            after: { platformFeeRate: numericRate }
        });
    },

    async adminProvision({ email, name, role }, adminId, adminRole, reason) {
        const auth = getAdminAuth();
        const db = getAdminDb();

        const user = await auth.getUserByEmail(email);
        const uid = user.uid;

        await auth.setCustomUserClaims(uid, {
            admin: true,
            admin_role: role
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
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAdminAction({
            adminId,
            adminRole,
            action: 'ADMIN_PROVISION',
            targetId: uid,
            targetType: 'user',
            reason,
            after: { role }
        });

        return { success: true };
    },

    // --- 📝 6. Logging & Audit ---
    async logAdminAction({ adminId, adminRole, action, targetId, targetType, reason, evidence, before, after, context }) {
        const db = getAdminDb();
        const log = {
            adminId,
            adminRole: adminRole || null,
            action,
            targetId,
            targetType,
            reason: reason || "",
            evidence: evidence || null,
            before: before || null,
            after: after || null,
            context: context || {},
            timestamp: FieldValue.serverTimestamp()
        };

        await db.collection('admin_audit_logs').add(log);
    },

    async updateVenueStatus(venueId, status, adminId, reason, evidence, context) {
        const db = getAdminDb();
        await db.collection('venues').doc(venueId).update({
            status,
            updatedAt: FieldValue.serverTimestamp()
        });

        await this.logAdminAction({
            adminId,
            action: status === 'suspended' ? 'VENUE_SUSPEND' : 'VENUE_REINSTATE',
            targetId: venueId,
            targetType: 'venue',
            reason,
            evidence,
            context
        });
    }
};
