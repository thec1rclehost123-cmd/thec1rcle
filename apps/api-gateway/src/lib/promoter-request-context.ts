import type { FastifyRequest } from 'fastify';
import type { Firestore } from 'firebase-admin/firestore';

export interface PromoterRequestContext {
    uid: string;
    promoterId: string;
    role: string;
    displayName: string;
    membershipId: string | null;
}

function pickDisplayName(source: Record<string, any>) {
    return String(source.displayName || source.name || source.email || source.uid || 'Promoter');
}

function isPromoterMembership(
    membership: Record<string, any> | null | undefined,
    options: { requireActive?: boolean } = {}
) {
    if (!membership) return false;
    if (String(membership.partnerType || '').toLowerCase() !== 'promoter') return false;
    if (options.requireActive === false) return Boolean(membership.partnerId);
    return membership.isActive === true || String(membership.status || '').toLowerCase() === 'active';
}

export async function resolvePromoterRequestContext(
    fastify: { db: Firestore },
    request: FastifyRequest & { user?: Record<string, any> | null; authContext?: Record<string, any> | null }
): Promise<PromoterRequestContext | null> {
    const user = request.user;
    if (!user?.uid) return null;

    const claimedMembership = user.activeMembership && isPromoterMembership(user.activeMembership, { requireActive: false })
        ? user.activeMembership
        : null;
    if (claimedMembership?.partnerId) {
        return {
            uid: String(user.uid),
            promoterId: String(claimedMembership.partnerId),
            role: String(claimedMembership.role || user.partnerRole || 'PROMOTER'),
            displayName: pickDisplayName(user),
<<<<<<< HEAD
            membershipId: String(claimedMembership.id || claimedMembership.membershipId || '') || null,
        };
=======
            membershipId: ((claimedMembership as any).id || (claimedMembership as any).membershipId) ? String((claimedMembership as any).id || (claimedMembership as any).membershipId) : null,
        } as PromoterRequestContext;
>>>>>>> 355ce04 (chore: sync business logic updates and prepare for gateway fix integration)
    }

    if (
        String(user.partnerType || '').toLowerCase() === 'promoter'
        && user.partnerId
    ) {
        return {
            uid: String(user.uid),
            promoterId: String(user.partnerId),
            role: String(user.partnerRole || user.role || 'PROMOTER'),
            displayName: pickDisplayName(user),
            membershipId: null,
        };
    }

    const activeMembership = Array.isArray(request.authContext?.memberships)
        ? request.authContext?.memberships.find((membership: Record<string, any>) => isPromoterMembership(membership))
        : null;
    if (activeMembership?.partnerId) {
        return {
            uid: String(user.uid),
            promoterId: String(activeMembership.partnerId),
            role: String(activeMembership.role || 'promoter').toUpperCase(),
            displayName: pickDisplayName(user),
<<<<<<< HEAD
            membershipId: String(activeMembership.id || activeMembership.membershipId || '') || null,
        };
=======
            membershipId: ((activeMembership as any).id || (activeMembership as any).membershipId) ? String((activeMembership as any).id || (activeMembership as any).membershipId) : null,
        } as PromoterRequestContext;
>>>>>>> 355ce04 (chore: sync business logic updates and prepare for gateway fix integration)
    }

    const membershipSnap = await fastify.db
        .collection('partner_memberships')
        .where('uid', '==', String(user.uid))
        .where('partnerType', '==', 'promoter')
        .where('isActive', '==', true)
        .limit(1)
        .get()
        .catch(async () =>
            fastify.db
                .collection('partner_memberships')
                .where('uid', '==', String(user.uid))
                .where('partnerType', '==', 'promoter')
                .limit(1)
                .get()
        );

    if (!membershipSnap.empty) {
        const membershipDoc = membershipSnap.docs[0];
        const membership = membershipDoc.data() || {};
        return {
            uid: String(user.uid),
            promoterId: String(membership.partnerId || user.uid),
            role: String(membership.role || 'PROMOTER').toUpperCase(),
            displayName: pickDisplayName(user),
            membershipId: membershipDoc.id,
<<<<<<< HEAD
        };
=======
        } as PromoterRequestContext;
>>>>>>> 355ce04 (chore: sync business logic updates and prepare for gateway fix integration)
    }

    const promoterDoc = await fastify.db.collection('promoters').doc(String(user.uid)).get();
    if (promoterDoc.exists) {
        const promoter = promoterDoc.data() || {};
        return {
            uid: String(user.uid),
            promoterId: promoterDoc.id,
            role: 'PROMOTER',
            displayName: pickDisplayName({ ...promoter, ...user }),
            membershipId: null,
<<<<<<< HEAD
        };
=======
        } as PromoterRequestContext;
>>>>>>> 355ce04 (chore: sync business logic updates and prepare for gateway fix integration)
    }

    return null;
}
