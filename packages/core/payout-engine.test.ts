import { describe, it, expect, vi } from 'vitest';
// Using the same technique as PromoService tests to mock dependencies
// We'll focus on testing the split calculation logic which is deterministic

// Since we want to test internal calculateOrderSplits, we might need to export it or test it via settleEvent
// Looking at payout-engine.js, calculateOrderSplits is NOT exported, but we can still test it if we use a clever mock for settleEvent or just export it for testing.
// Actually, I'll just rewrite the split calculation in a testable way or mock the DB calls in settleEvent.

// For now, let's look at ledger-engine.js constants and types which are crucial.
import { calculateOrderSplits } from './payout-engine.js';
import { MONEY_STATES, ACCOUNTS } from './ledger-engine.js';

describe('Payout Engine Logic', () => {
    describe('calculateOrderSplits', () => {
        const mockEvent = {
            creatorId: 'host-1',
            creatorRole: 'host',
            venueId: 'club-1'
        };

        it('should split 70/30 between club and host for host events', () => {
            const order = { totalAmount: 1000, id: 'o1' };
            const splits = calculateOrderSplits(order, mockEvent);

            // Platform 5% = 50
            // Remaining 950
            // Host 30% of 950 = 285
            // Club 70% of 950 = 665

            const platformSplit = splits.find(s => s.actorId === ACCOUNTS.PLATFORM_FEE);
            const hostSplit = splits.find(s => s.actorType === 'host');
            const clubSplit = splits.find(s => s.actorType === 'venue');

            expect(platformSplit.amount).toBe(50);
            expect(hostSplit.amount).toBe(285);
            expect(clubSplit.amount).toBe(665);
            expect(platformSplit.amount + hostSplit.amount + clubSplit.amount).toBe(1000);
        });

        it('should give 100% (after platform fee) to venue for direct club events', () => {
            const clubEvent = { creatorRole: 'venue', venueId: 'club-1' };
            const order = { totalAmount: 1000, id: 'o1' };
            const splits = calculateOrderSplits(order, clubEvent);

            const platformSplit = splits.find(s => s.actorId === ACCOUNTS.PLATFORM_FEE);
            const venueSplit = splits.find(s => s.actorType === 'venue');

            expect(platformSplit.amount).toBe(50);
            expect(venueSplit.amount).toBe(950);
        });

        it('should handle promoter commissions', () => {
            const order = {
                totalAmount: 1000,
                id: 'o1',
                promoterLinkId: 'p1',
                promoterAttribution: { promoterId: 'promoter-1', commissionAmount: 100 }
            };
            const splits = calculateOrderSplits(order, mockEvent);

            // Total 1000
            // Promoter 100
            // Platform 50
            // Remaining 850
            // Host 30% of 850 = 255
            // Club 70% of 850 = 595

            const promoterSplit = splits.find(s => s.actorType === 'promoter');
            expect(promoterSplit.amount).toBe(100);
            expect(splits.reduce((sum, s) => sum + s.amount, 0)).toBe(1000);
        });
    });
});
