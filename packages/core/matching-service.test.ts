import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MatchingService } from './src/domain/services/matching-service.js';

// Mock dependencies
const mockMatchingRepo = {
    getInteractedIds: vi.fn(),
    saveInteraction: vi.fn(),
};

const mockProfileRepo = {
    getById: vi.fn(),
};

const mockEventRepo = {
    list: vi.fn(),
    getById: vi.fn(),
};

vi.mock('./redis.js', () => ({
    getRedisClient: () => ({
        get: vi.fn(),
        set: vi.fn(),
        zincrby: vi.fn(),
        zrevrange: vi.fn(),
        expire: vi.fn(),
    })
}));

vi.mock('./rate-limiter.js', () => ({
    checkRateLimit: vi.fn(() => ({ success: true }))
}));

describe('MatchingService', () => {
    let service: MatchingService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new MatchingService(
            mockMatchingRepo as any,
            mockProfileRepo as any,
            mockEventRepo as any
        );
    });

    describe('calculateInterestScore', () => {
        it('should return higher score for matching interests', () => {
            const user = { interests: ['music', 'tech'] };
            const target = { genres: ['music', 'art'] };
            // @ts-ignore - accessing private for testing
            const score = service.calculateInterestScore(user, target);
            expect(score).toBeGreaterThan(0);
            expect(score).toBe(0.5); // 1 match / 2 user interests
        });

        it('should apply adaptive boosts', () => {
            const user = { interests: ['music'] };
            const target = { genres: ['music'] };
            const boosts = { 'music': 2 };
            // @ts-ignore
            const score = service.calculateInterestScore(user, target, boosts);
            expect(score).toBe(1.0); // 1 + (2 * 0.1) = 1.2 -> capped at 1.0
        });
    });

    describe('calculateProximityScore', () => {
        it('should return 1.0 for same coordinates', () => {
            const target = { coordinates: { latitude: 10, longitude: 10 } };
            // @ts-ignore
            const score = service.calculateProximityScore(10, 10, target);
            expect(score).toBe(1.0);
        });

        it('should return 0.0 for very far coordinates', () => {
            const target = { coordinates: { latitude: 20, longitude: 20 } };
            // @ts-ignore
            const score = service.calculateProximityScore(10, 10, target);
            expect(score).toBe(0);
        });
    });

    describe('getMatchFeed', () => {
        it('should return scored and sorted candidates', async () => {
            mockProfileRepo.getById.mockResolvedValue({ id: 'u1', interests: ['tech'] });
            mockMatchingRepo.getInteractedIds.mockResolvedValue([]);
            mockEventRepo.list.mockResolvedValue([
                { id: 'e1', genres: ['tech'], coordinates: { latitude: 10, longitude: 10 } },
                { id: 'e2', genres: ['music'], coordinates: { latitude: 10, longitude: 10 } }
            ]);

            const feed = await service.getMatchFeed('u1', { lat: 10, lng: 10 });

            expect(feed).toHaveLength(2);
            expect(feed[0].id).toBe('e1'); // e1 has tech interest match
            expect(feed[0].matchScore).toBeGreaterThan(feed[1].matchScore);
        });
    });

    describe('handleSwipe', () => {
        it('should save interaction on swipe', async () => {
            await service.handleSwipe('u1', 'e1', 'event', 'right');
            expect(mockMatchingRepo.saveInteraction).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'u1',
                targetId: 'e1',
                direction: 'right'
            }));
        });
    });
});
