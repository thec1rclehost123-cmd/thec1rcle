import type { Firestore, Query } from 'firebase-admin/firestore';

type TimelineRange = '7d' | '30d' | '90d' | 'ytd' | 'all';

export interface PromoterActorContext {
    uid: string;
    promoterId: string;
    role: string;
    displayName: string;
    membershipId: string | null;
}

type LinkFilters = {
    eventId?: string;
    status?: string;
    limit?: number;
};

type EventFilters = {
    city?: string;
    status?: string;
    limit?: number;
};

type FinanceFilters = {
    status?: string;
    limit?: number;
};

function toIso(value: any): string | null {
    if (!value) return null;
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
    }
    return null;
}

function toDate(value: any): Date | null {
    const iso = toIso(value);
    if (!iso) return null;
    const parsed = new Date(iso);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value: unknown) {
    const amount = Number(value || 0);
    return Number.isFinite(amount) ? amount : 0;
}

function pickString(...values: any[]) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
}

function buildDateLabel(value: any) {
    const date = toDate(value);
    if (!date) return 'Date TBA';
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function normalizeCurrency(value: any) {
    const raw = pickString(value, 'INR').toUpperCase();
    return raw || 'INR';
}

function isTruthyStatus(status: any, candidates: string[]) {
    return candidates.includes(String(status || '').toLowerCase());
}

function isPromotableEvent(event: Record<string, any>, promoterId: string) {
    const globallyEnabled = event?.promotersEnabled === true || event?.promoterSettings?.enabled === true;
    if (!globallyEnabled) return false;
    const allowedIds = Array.isArray(event?.promoterSettings?.allowedPromoterIds)
        ? event.promoterSettings.allowedPromoterIds.map((value: any) => String(value))
        : [];
    return allowedIds.length === 0 || allowedIds.includes(String(promoterId));
}

function isLiveLikeLifecycle(value: any) {
    return ['scheduled', 'approved', 'upcoming', 'live'].includes(String(value || '').toLowerCase());
}

function rangeStart(range: TimelineRange) {
    const now = new Date();
    switch (range) {
        case '7d':
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30d':
            return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case '90d':
            return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        case 'ytd':
            return new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        case 'all':
        default:
            return null;
    }
}

function dateBucket(value: any) {
    const date = toDate(value);
    if (!date) return null;
    return date.toISOString().slice(0, 10);
}

function maskName(name: string) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return 'Guest';
    const parts = trimmed.split(/\s+/);
    return parts.map((part, index) => (index === 0 ? part : `${part[0]}.`)).join(' ');
}

async function safeOrderedQuery(query: Query, limit: number) {
    return query
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get()
        .catch(() => query.limit(limit).get());
}

export class PromoterServiceV2 {
    constructor(private readonly db: Firestore) {}

    async getOverview(context: PromoterActorContext) {
        const [profile, linksPayload, financePayload] = await Promise.all([
            this.getProfile(context),
            this.listLinks(context, { limit: 100 }),
            this.getFinance(context, { limit: 50 }),
        ]);

        const activeLinks = linksPayload.items.filter((link: any) => link.isActive);
        const topLink = [...linksPayload.items].sort((left: any, right: any) =>
            toNumber(right.conversions) - toNumber(left.conversions)
            || toNumber(right.clicks) - toNumber(left.clicks)
        )[0] || null;

        const activeAssignments = activeLinks
            .filter((link: any) => link.eventId)
            .slice(0, 8)
            .map((link: any) => ({
                id: link.id,
                eventId: link.eventId,
                eventName: link.eventTitle || 'Event',
                eventDate: link.eventDateIso || null,
                venueName: link.venueName || '',
                city: link.city || '',
                coverImage: link.eventImage || null,
                status: link.status || 'active',
                ticketsSold: toNumber(link.conversions),
                commission: toNumber(link.commission),
            }));

        const recentActivity = financePayload.commissionRows.slice(0, 6).map((row: any) => ({
            id: row.id,
            type: 'commission',
            title: `${row.eventName || 'Event'} conversion`,
            amount: row.amount,
            currency: row.currency,
            status: row.status,
            occurredAt: row.date,
        }));

        return {
            promoter: profile.profile,
            kpis: {
                totalLinks: linksPayload.summary.totalLinks,
                activeLinks: linksPayload.summary.activeLinks,
                totalClicks: linksPayload.summary.totalClicks,
                totalConversions: linksPayload.summary.totalConversions,
                totalRevenue: linksPayload.summary.totalRevenue,
                totalCommission: linksPayload.summary.totalCommission,
                activeEvents: activeAssignments.length,
            },
            activeAssignments,
            topLink,
            recentActivity,
            financeSnapshot: financePayload.balance,
            meta: {
                version: 'v2-parallel-read',
                dataSources: ['promoter_links', 'promoter_commissions', 'partner_ledger', 'payouts', 'promoters'],
            },
        };
    }

    async getAnalytics(context: PromoterActorContext, filters: { range?: TimelineRange; eventId?: string }) {
        const range = filters.range || '30d';
        const [linksPayload, commissionRows] = await Promise.all([
            this.listLinks(context, { eventId: filters.eventId, limit: 200 }),
            this.loadCommissionRows(context.promoterId, filters.eventId, 250),
        ]);

        const start = rangeStart(range);
        const rows = start
            ? commissionRows.filter((row) => {
                const date = toDate(row.date);
                return date ? date >= start : false;
            })
            : commissionRows;

        const timelineMap = new Map<string, { date: string; conversions: number; revenue: number; commission: number; clicks: number }>();
        rows.forEach((row) => {
            const bucket = dateBucket(row.date);
            if (!bucket) return;
            const existing = timelineMap.get(bucket) || { date: bucket, conversions: 0, revenue: 0, commission: 0, clicks: 0 };
            existing.conversions += 1;
            existing.revenue += toNumber(row.revenue);
            existing.commission += toNumber(row.amount);
            timelineMap.set(bucket, existing);
        });

        const timeline = [...timelineMap.values()].sort((left, right) => left.date.localeCompare(right.date));
        const summary = {
            totalLinks: linksPayload.summary.totalLinks,
            activeLinks: linksPayload.summary.activeLinks,
            totalClicks: linksPayload.summary.totalClicks,
            totalConversions: rows.length,
            totalRevenue: rows.reduce((sum, row) => sum + toNumber(row.revenue), 0),
            totalCommission: rows.reduce((sum, row) => sum + toNumber(row.amount), 0),
            conversionRate: linksPayload.summary.totalClicks > 0
                ? Number(((rows.length / linksPayload.summary.totalClicks) * 100).toFixed(2))
                : 0,
        };

        const eventOptions = Array.from(
            new Map(
                linksPayload.items
                    .filter((link: any) => link.eventId)
                    .map((link: any) => [String(link.eventId), {
                        eventId: link.eventId,
                        eventTitle: link.eventTitle || 'Event',
                        city: link.city || '',
                        venueName: link.venueName || '',
                    }])
            ).values()
        );

        return {
            summary,
            timeline,
            topLinks: linksPayload.items.slice(0, 10),
            eventOptions,
            dataCompleteness: {
                clickTimeline: false,
                revenueTimeline: true,
                commissionTimeline: true,
            },
            meta: {
                version: 'v2-parallel-read',
                appliedRange: range,
            },
        };
    }

    async listLinks(context: PromoterActorContext, filters: LinkFilters = {}) {
        const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
        let query: Query = this.db.collection('promoter_links')
            .where('promoterId', '==', context.promoterId);

        if (filters.eventId) {
            query = query.where('eventId', '==', String(filters.eventId));
        }

        const snapshot = await safeOrderedQuery(query, limit);
        let docs = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })) as any[];

        if (filters.status) {
            const status = String(filters.status).toLowerCase();
            docs = docs.filter((doc) => {
                const current = String(doc.status || (doc.isActive ? 'active' : 'inactive')).toLowerCase();
                if (status === 'active') return doc.isActive === true || current === 'active';
                if (status === 'inactive') return doc.isActive === false || current !== 'active';
                return current === status;
            });
        }

        docs = docs
            .sort((left, right) => {
                const leftTime = toDate(left.createdAt)?.getTime() || 0;
                const rightTime = toDate(right.createdAt)?.getTime() || 0;
                return rightTime - leftTime;
            })
            .slice(0, limit);

        const eventMap = await this.loadEventsByIds(docs.map((doc) => String(doc.eventId || '')));
        const items = docs.map((doc) => {
            const event = eventMap.get(String(doc.eventId || '')) || {};
            return {
                id: String(doc.id),
                code: pickString(doc.code),
                eventId: pickString(doc.eventId),
                eventTitle: pickString(doc.eventTitle, event.title, event.name, 'Event'),
                eventSlug: pickString(doc.eventSlug, event.slug),
                eventDateIso: toIso(event.startDate || event.date || event.eventDate),
                eventImage: pickString(event.image, event.coverImage, event.poster, event.bannerImage),
                venueName: pickString(event.venueName, event.venue, event.locationName),
                city: pickString(event.city, doc.city),
                campaignLabel: pickString(doc.campaignLabel, doc.label),
                fullUrl: pickString(doc.fullUrl),
                channel: pickString(doc.channel),
                status: pickString(doc.status, doc.isActive === false ? 'inactive' : 'active'),
                isActive: doc.isActive !== false && String(doc.status || '').toLowerCase() !== 'deactivated',
                clicks: toNumber(doc.clicks),
                conversions: toNumber(doc.conversions),
                revenue: toNumber(doc.revenue),
                commission: toNumber(doc.commission),
                commissionRate: toNumber(doc.commissionRate),
                commissionType: pickString(doc.commissionType, 'percentage'),
                createdAt: toIso(doc.createdAt),
                updatedAt: toIso(doc.updatedAt),
                lastClickAt: toIso(doc.lastClickAt),
                expiresAt: toIso(doc.expiresAt),
            };
        });

        return {
            items,
            summary: {
                totalLinks: items.length,
                activeLinks: items.filter((item) => item.isActive).length,
                totalClicks: items.reduce((sum, item) => sum + item.clicks, 0),
                totalConversions: items.reduce((sum, item) => sum + item.conversions, 0),
                totalRevenue: items.reduce((sum, item) => sum + item.revenue, 0),
                totalCommission: items.reduce((sum, item) => sum + item.commission, 0),
            },
            nextCursor: null,
            meta: {
                version: 'v2-parallel-read',
            },
        };
    }

    async listEvents(context: PromoterActorContext, filters: EventFilters = {}) {
        const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
        const [directEnabled, settingsEnabled, linksPayload] = await Promise.all([
            this.db.collection('events').where('promotersEnabled', '==', true).limit(limit * 2).get().catch(() => ({ docs: [] as any[] })),
            this.db.collection('events').where('promoterSettings.enabled', '==', true).limit(limit * 2).get().catch(() => ({ docs: [] as any[] })),
            this.listLinks(context, { limit: 200 }),
        ]);

        const activeLinkByEventId = new Map(
            linksPayload.items
                .filter((link: any) => link.isActive && link.eventId)
                .map((link: any) => [String(link.eventId), link])
        );

        const deduped = new Map<string, Record<string, any>>();
        [...directEnabled.docs, ...settingsEnabled.docs].forEach((doc: any) => {
            deduped.set(doc.id, { id: doc.id, ...(doc.data() || {}) });
        });

        let items = [...deduped.values()]
            .filter((event) => isPromotableEvent(event, context.promoterId))
            .filter((event) => {
                if (!filters.status) return isLiveLikeLifecycle(event.lifecycle || event.status);
                return String(event.lifecycle || event.status || '').toLowerCase() === String(filters.status).toLowerCase();
            })
            .filter((event) => {
                if (!filters.city) return true;
                const city = pickString(event.city, event.cityName).toLowerCase();
                return city.includes(String(filters.city).trim().toLowerCase());
            })
            .sort((left, right) => {
                const leftTime = toDate(left.startDate || left.date || left.eventDate)?.getTime() || 0;
                const rightTime = toDate(right.startDate || right.date || right.eventDate)?.getTime() || 0;
                return leftTime - rightTime;
            })
            .slice(0, limit)
            .map((event) => {
                const activeLink = activeLinkByEventId.get(String(event.id));
                return {
                    id: String(event.id),
                    title: pickString(event.title, event.name, 'Event'),
                    slug: pickString(event.slug),
                    lifecycle: pickString(event.lifecycle, event.status, 'scheduled'),
                    city: pickString(event.city, event.cityName),
                    venueName: pickString(event.venueName, event.venue, event.locationName),
                    imageUrl: pickString(event.image, event.coverImage, event.poster, event.bannerImage),
                    startDate: toIso(event.startDate || event.date || event.eventDate),
                    dateLabel: buildDateLabel(event.startDate || event.date || event.eventDate),
                    activeLink: activeLink ? {
                        id: activeLink.id,
                        code: activeLink.code,
                        fullUrl: activeLink.fullUrl,
                        clicks: activeLink.clicks,
                        conversions: activeLink.conversions,
                        revenue: activeLink.revenue,
                    } : null,
                };
            });

        return {
            items,
            summary: {
                totalEvents: items.length,
                activeLinkedEvents: items.filter((item) => Boolean(item.activeLink)).length,
                liveEvents: items.filter((item) => String(item.lifecycle).toLowerCase() === 'live').length,
                scheduledEvents: items.filter((item) => String(item.lifecycle).toLowerCase() !== 'live').length,
            },
            nextCursor: null,
            meta: {
                version: 'v2-parallel-read',
            },
        };
    }

    async getFinance(context: PromoterActorContext, filters: FinanceFilters = {}) {
        const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
        const [commissionRows, payoutDocs, payoutAccountDoc] = await Promise.all([
            this.loadCommissionRows(context.promoterId, undefined, limit),
            this.loadPayoutDocs(context.promoterId),
            this.db.collection('promoter_payout_accounts').doc(context.promoterId).get(),
        ]);

        const payouts = payoutDocs
            .map((doc) => {
                const data = doc.data() || {};
                return {
                    id: doc.id,
                    amount: toNumber(data.amount),
                    currency: normalizeCurrency(data.currency),
                    status: String(data.status || 'pending').toLowerCase(),
                    paymentMethod: pickString(data.paymentMethod, data.method, 'bank_transfer'),
                    requestedAt: toIso(data.requestedAt || data.createdAt || data.timestamp),
                    completedAt: toIso(data.completedAt || data.updatedAt || data.timestamp),
                    bankName: pickString(data.bankName),
                    last4: pickString(data.last4, data.accountLast4),
                };
            })
            .filter((payout) => !filters.status || payout.status === String(filters.status).toLowerCase())
            .sort((left, right) => {
                const leftTime = toDate(left.requestedAt || left.completedAt)?.getTime() || 0;
                const rightTime = toDate(right.requestedAt || right.completedAt)?.getTime() || 0;
                return rightTime - leftTime;
            });

        const totals = commissionRows.reduce((acc, row) => {
            acc.totalEarned += row.amount;
            if (row.status === 'pending' || row.status === 'clearing') acc.pending += row.amount;
            if (row.status === 'cleared' || row.status === 'paid') acc.cleared += row.amount;
            return acc;
        }, { totalEarned: 0, pending: 0, cleared: 0 });

        const totalPaid = payouts
            .filter((payout) => isTruthyStatus(payout.status, ['completed', 'paid', 'cleared']))
            .reduce((sum, payout) => sum + Math.abs(payout.amount), 0);
        const pendingPayouts = payouts
            .filter((payout) => isTruthyStatus(payout.status, ['pending', 'processing', 'in_transit']))
            .reduce((sum, payout) => sum + Math.abs(payout.amount), 0);

        const payoutAccount = payoutAccountDoc.exists ? payoutAccountDoc.data() || {} : {};

        return {
            balance: {
                totalEarned: totals.totalEarned,
                pending: totals.pending,
                available: Math.max(0, totals.cleared - totalPaid - pendingPayouts),
                totalPaid,
                instantAvailable: 0,
                currency: 'INR',
            },
            commissionRows,
            payoutAccounts: payoutAccountDoc.exists ? [{
                id: context.promoterId,
                bankName: pickString(payoutAccount.bankName, payoutAccount.paymentMethod, 'Bank'),
                last4: pickString(payoutAccount.last4, payoutAccount.accountLast4, '****'),
                isDefault: true,
                paymentType: payoutAccount.upiId ? 'upi' : 'bank_account',
                threshold: toNumber(payoutAccount.threshold),
                holdUntil: toIso(payoutAccount.holdUntil),
            }] : [],
            payouts,
            payoutSummary: {
                pendingCount: payouts.filter((payout) => isTruthyStatus(payout.status, ['pending', 'processing', 'in_transit'])).length,
                paidCount: payouts.filter((payout) => isTruthyStatus(payout.status, ['completed', 'paid', 'cleared'])).length,
                totalRequested: payouts.reduce((sum, payout) => sum + payout.amount, 0),
            },
            meta: {
                version: 'v2-parallel-read',
                commissionSource: commissionRows.some((row) => row.source === 'promoter_commissions')
                    ? 'promoter_commissions'
                    : commissionRows.some((row) => row.source === 'partner_ledger')
                        ? 'partner_ledger'
                        : commissionRows.some((row) => row.source === 'promoter_ledger')
                            ? 'promoter_ledger'
                            : 'promoter_assignments',
            },
        };
    }

    async listPayouts(context: PromoterActorContext, filters: FinanceFilters = {}) {
        const finance = await this.getFinance(context, filters);
        return {
            balance: finance.balance,
            items: finance.payouts,
            nextCursor: null,
            meta: finance.meta,
        };
    }

    async getProfile(context: PromoterActorContext) {
        const doc = await this.db.collection('promoters').doc(context.promoterId).get();
        const promoter = doc.exists ? doc.data() || {} : {};

        return {
            profile: {
                id: context.promoterId,
                uid: context.uid,
                role: context.role,
                displayName: pickString(promoter.displayName, promoter.brandName, promoter.name, context.displayName),
                legalName: pickString(promoter.legalName),
                brandName: pickString(promoter.brandName, promoter.displayName, promoter.name),
                email: pickString(promoter.email),
                phone: pickString(promoter.phone, promoter.contactPhone),
                city: pickString(promoter.city),
                bio: pickString(promoter.bio, promoter.summary),
                handle: pickString(promoter.handle, promoter.username),
                instagram: pickString(promoter.instagram),
                avatarUrl: pickString(promoter.avatarUrl, promoter.photoURL, promoter.profileImage),
                coverImageUrl: pickString(promoter.coverImage, promoter.bannerImage),
                website: pickString(promoter.website),
                socialLinks: Object.fromEntries(
                    Object.entries({
                        instagram: pickString(promoter.instagram),
                        twitter: pickString(promoter.twitter),
                        website: pickString(promoter.website),
                    }).filter(([, value]) => Boolean(value))
                ),
                isVerified: promoter.isVerified === true || String(promoter.kycStatus || '').toLowerCase() === 'verified',
                createdAt: toIso(promoter.createdAt),
                updatedAt: toIso(promoter.updatedAt),
            },
            meta: {
                version: 'v2-parallel-read',
            },
        };
    }

    async getSettings(context: PromoterActorContext) {
        const [identityDoc, verificationDoc, payoutDoc, preferencesDoc] = await Promise.all([
            this.db.collection('promoters').doc(context.promoterId).get(),
            this.db.collection('promoter_verification').doc(context.promoterId).get(),
            this.db.collection('promoter_payout_accounts').doc(context.promoterId).get(),
            this.db.collection('promoter_preferences').doc(context.promoterId).get(),
        ]);

        return {
            settings: {
                identity: identityDoc.exists ? identityDoc.data() || null : null,
                verification: verificationDoc.exists ? verificationDoc.data() || null : null,
                payout: payoutDoc.exists ? payoutDoc.data() || null : null,
                preferences: preferencesDoc.exists ? preferencesDoc.data() || null : null,
            },
            meta: {
                version: 'v2-parallel-read',
            },
        };
    }

    private async loadEventsByIds(eventIds: string[]) {
        const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)));
        const docs = await Promise.all(uniqueIds.map((eventId) => this.db.collection('events').doc(eventId).get()));
        return docs.reduce((map, doc) => {
            if (doc.exists) map.set(doc.id, doc.data() || {});
            return map;
        }, new Map<string, Record<string, any>>());
    }

    private async loadPayoutDocs(promoterId: string) {
        const [partnerPayouts, legacyPayouts] = await Promise.all([
            this.db.collection('payouts').where('partnerId', '==', promoterId).limit(100).get(),
            this.db.collection('payouts').where('promoterId', '==', promoterId).limit(100).get(),
        ]);

        const deduped = new Map<string, any>();
        [...partnerPayouts.docs, ...legacyPayouts.docs].forEach((doc) => {
            deduped.set(doc.id, doc);
        });

        return [...deduped.values()];
    }

    private async loadCommissionRows(promoterId: string, eventId?: string, limit = 200) {
        const commissionRows = await this.loadCommissionCollectionRows(promoterId, eventId, limit);
        if (commissionRows.length > 0) return commissionRows;

        // partner_ledger is canonical — check before legacy promoter_ledger
        const partnerLedgerRows = await this.loadPartnerLedgerRows(promoterId, eventId, limit);
        if (partnerLedgerRows.length > 0) return partnerLedgerRows;

        // promoter_ledger: historical fallback for entries created before migration
        const ledgerRows = await this.loadLegacyLedgerRows(promoterId, eventId, limit);
        if (ledgerRows.length > 0) return ledgerRows;

        // promoter_assignments: oldest fallback — event-level aggregates only
        return this.loadAssignmentRows(promoterId, eventId, limit);
    }

    private async loadPartnerLedgerRows(promoterId: string, eventId?: string, limit = 200) {
        let query: Query = this.db.collection('partner_ledger')
            .where('toPartnerId', '==', promoterId)
            .where('type', '==', 'promoter_commission');
        const snapshot = await safeOrderedQuery(query, limit);
        let rows = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })) as any[];
        if (eventId) rows = rows.filter((row) => String(row.eventId || '') === String(eventId));

        const orderMap = await this.loadOrdersByIds(rows.map((row) => String(row.referenceId || '')));
        const eventMap = await this.loadEventsByIds(rows.map((row) => String(row.eventId || '')));

        return rows
            .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0))
            .slice(0, limit)
            .map((row) => {
                const order = orderMap.get(String(row.referenceId || '')) || {};
                const event = eventMap.get(String(row.eventId || '')) || {};
                const status = row.status === 'settled' ? 'cleared'
                    : row.status === 'failed' ? 'rejected'
                    : 'pending';
                return {
                    id: String(row.id),
                    source: 'partner_ledger',
                    orderId: pickString(row.referenceId),
                    eventId: pickString(row.eventId),
                    eventName: pickString(event.title, event.name, order.eventTitle, 'Event'),
                    buyerName: maskName(pickString(order.guestName, order.buyerName, order.userName, 'Guest')),
                    amount: toNumber(row.amount),
                    revenue: toNumber(order.totalAmount || order.amount || 0),
                    ticketsSold: Array.isArray(order.tickets)
                        ? order.tickets.reduce((s: number, t: any) => s + toNumber(t?.quantity || 1), 0)
                        : toNumber(order.quantity || 1),
                    commissionRate: toNumber(order?.promoterAttribution?.commissionRate || 0),
                    linkCode: pickString(order.promoterCode, order?.promoterAttribution?.linkCode),
                    status,
                    date: toIso(row.createdAt),
                    settledAt: toIso(row.settledAt),
                    currency: 'INR',
                };
            });
    }

    private async loadCommissionCollectionRows(promoterId: string, eventId?: string, limit = 200) {
        let query: Query = this.db.collection('promoter_commissions').where('promoterId', '==', promoterId);
        if (eventId) {
            query = query.where('eventId', '==', String(eventId));
        }

        const snapshot = await safeOrderedQuery(query, limit);
        const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })) as any[];
        const orderMap = await this.loadOrdersByIds(rows.map((row) => String(row.orderId || '')));
        const eventMap = await this.loadEventsByIds(rows.map((row) => String(row.eventId || '')));

        return rows
            .sort((left, right) => {
                const leftTime = toDate(left.createdAt)?.getTime() || 0;
                const rightTime = toDate(right.createdAt)?.getTime() || 0;
                return rightTime - leftTime;
            })
            .slice(0, limit)
            .map((row) => {
                const order = orderMap.get(String(row.orderId || '')) || {};
                const event = eventMap.get(String(row.eventId || '')) || {};
                return {
                    id: String(row.id),
                    source: 'promoter_commissions',
                    orderId: pickString(row.orderId),
                    eventId: pickString(row.eventId),
                    eventName: pickString(event.title, event.name, row.eventName, 'Event'),
                    buyerName: maskName(pickString(order.guestName, order.buyerName, order.userName, row.buyerName, 'Guest')),
                    amount: toNumber(row.commissionAmount),
                    revenue: toNumber(row.orderAmount),
                    ticketsSold: 1,
                    commissionRate: toNumber(row.commissionRate),
                    linkCode: pickString(row.linkCode, row.code),
                    status: String(row.status || 'pending').toLowerCase(),
                    date: toIso(row.createdAt),
                    settledAt: toIso(row.updatedAt),
                    currency: 'INR',
                };
            });
    }

    private async loadLegacyLedgerRows(promoterId: string, eventId?: string, limit = 200) {
        let query: Query = this.db.collection('promoter_ledger').where('promoterId', '==', promoterId);
        const snapshot = await safeOrderedQuery(query, limit);
        let rows = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })) as any[];
        if (eventId) {
            rows = rows.filter((row) => String(row.eventId || '') === String(eventId));
        }

        const orderMap = await this.loadOrdersByIds(rows.map((row) => String(row.orderId || '')));
        const eventMap = await this.loadEventsByIds(
            rows.map((row) => String(row.eventId || orderMap.get(String(row.orderId || ''))?.eventId || ''))
        );

        return rows
            .sort((left, right) => {
                const leftTime = toDate(left.createdAt)?.getTime() || 0;
                const rightTime = toDate(right.createdAt)?.getTime() || 0;
                return rightTime - leftTime;
            })
            .slice(0, limit)
            .map((row) => {
                const order = orderMap.get(String(row.orderId || '')) || {};
                const resolvedEventId = pickString(row.eventId, order.eventId);
                const event = eventMap.get(resolvedEventId) || {};
                return {
                    id: String(row.id),
                    source: 'promoter_ledger',
                    orderId: pickString(row.orderId),
                    eventId: resolvedEventId,
                    eventName: pickString(event.title, order.eventTitle, row.eventName, 'Event'),
                    buyerName: maskName(pickString(order.guestName, order.buyerName, order.userName, row.buyerName, 'Guest')),
                    amount: toNumber(row.commissionAmount),
                    revenue: toNumber(row.orderAmount || order.totalAmount || order.amount),
                    ticketsSold: Array.isArray(order.tickets)
                        ? order.tickets.reduce((sum: number, ticket: any) => sum + toNumber(ticket?.quantity || 1), 0)
                        : toNumber(order.quantity || 1),
                    commissionRate: toNumber(row.commissionRate || order?.promoterAttribution?.commissionRate),
                    linkCode: pickString(row.promoCode, order.promoterCode),
                    status: isTruthyStatus(row.status, ['paid', 'completed'])
                        ? 'paid'
                        : isTruthyStatus(row.status, ['cleared', 'settled', 'eligible']) || isTruthyStatus(event.lifecycle || event.status, ['completed', 'ended', 'closed'])
                            ? 'cleared'
                            : 'pending',
                    date: toIso(row.createdAt || order.createdAt),
                    settledAt: toIso(row.settledAt || row.updatedAt || event.updatedAt || event.endDate),
                    currency: 'INR',
                };
            });
    }

    private async loadAssignmentRows(promoterId: string, eventId?: string, limit = 200) {
        let query: Query = this.db.collection('promoter_assignments').where('promoterId', '==', promoterId);
        const snapshot = await safeOrderedQuery(query, limit);
        let rows = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) })) as any[];
        if (eventId) {
            rows = rows.filter((row) => String(row.eventId || '') === String(eventId));
        }

        return rows
            .sort((left, right) => {
                const leftTime = toDate(left.createdAt)?.getTime() || 0;
                const rightTime = toDate(right.createdAt)?.getTime() || 0;
                return rightTime - leftTime;
            })
            .slice(0, limit)
            .map((row) => ({
                id: String(row.id),
                source: 'promoter_assignments',
                orderId: null,
                eventId: pickString(row.eventId),
                eventName: pickString(row.eventName, row.eventTitle, 'Event'),
                buyerName: maskName(pickString(row.buyerName, row.guestName, 'Guest')),
                amount: toNumber(row.totalCommission || row.commissionEarned),
                revenue: toNumber(row.totalRevenue || row.revenue),
                ticketsSold: toNumber(row.totalSales || row.ticketsSold),
                commissionRate: toNumber(row.commissionRate),
                linkCode: pickString(row.linkCode, row.code),
                status: String(row.commissionStatus || row.status || 'pending').toLowerCase(),
                date: toIso(row.createdAt),
                settledAt: toIso(row.settledAt || row.updatedAt),
                currency: 'INR',
            }));
    }

    private async loadOrdersByIds(orderIds: string[]) {
        const uniqueIds = Array.from(new Set(orderIds.filter(Boolean)));
        const docs = await Promise.all(uniqueIds.map((orderId) => this.db.collection('orders').doc(orderId).get()));
        return docs.reduce((map, doc) => {
            if (doc.exists) map.set(doc.id, doc.data() || {});
            return map;
        }, new Map<string, Record<string, any>>());
    }
}
