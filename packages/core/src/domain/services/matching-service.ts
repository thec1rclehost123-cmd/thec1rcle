import { IMatchingRepository, Interaction } from '../repositories/matching-repository.js';
import { IProfileRepository } from '../repositories/profile-repository.js';
import { IEventRepository } from '../repositories/event-repository.js';
// @ts-ignore
import { getRedisClient } from '../../../redis.js';
// @ts-ignore
import { checkRateLimit } from '../../../rate-limiter.js';

export class MatchingService {
  constructor(
    private matchingRepo: IMatchingRepository,
    private profileRepo: IProfileRepository,
    private eventRepo: IEventRepository,
  ) {}

  async getMatchFeed(
    userId: string,
    options: {
      lat?: number;
      lng?: number;
      limit?: number;
      type?: 'user' | 'event';
    },
    workspaceId: string,
  ): Promise<any[]> {
    const { lat, lng, limit = 20, type = 'event' } = options;
    const redis = getRedisClient();
    const cacheKey = `match_feed:${userId}:${type}:${lat || 0}:${lng || 0}:${limit}`;

    // 1. Try Cache
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.warn('Redis cache read failed:', e);
    }

    // 2-4. Parallelize independent fetches (Optimization Fix)
    const [userProfile, adaptiveBoosts, excludedIds, candidates] = await Promise.all([
      this.profileRepo.getById(userId, 'user'),
      this.getAdaptiveBoosts(userId),
      this.matchingRepo.getInteractedIds(userId, type),
      type === 'event'
        ? this.eventRepo.list({ status: 'live', limit: 100 }, workspaceId)
        : Promise.resolve([]),
    ]);

    if (!userProfile) throw new Error('User profile not found');

    // 5. Weighting & Scoring Model V1 + Adaptive Boost
    // Score = (Interests * 40%) + (Proximity * 40%) + (Activity * 20%)
    const scoredCandidates = candidates
      .filter((c) => !excludedIds.includes(c.id))
      .map((candidate) => {
        const interestScore = this.calculateInterestScore(userProfile, candidate, adaptiveBoosts);
        const proximityScore = this.calculateProximityScore(lat, lng, candidate);
        const activityScore = this.calculateActivityScore(candidate);

        const finalScore = interestScore * 0.4 + proximityScore * 0.4 + activityScore * 0.2;

        // 🛡️ Phase 6: Redact PII in discovery feed
        const redactedCandidate = {
          id: candidate.id,
          type: type,
          matchScore: Math.round(finalScore * 100) / 100,
          // Generic placeholders for discovery phase
          displayName: type === 'user' ? 'Attendee' : candidate.title,
          photoURL: type === 'user' ? null : candidate.image || candidate.poster,
          interests: candidate.genres || candidate.interests || [],
          stats: candidate.stats || {},
        };

        return redactedCandidate;
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    // 6. Save to Cache (15m TTL)
    try {
      await redis.set(cacheKey, JSON.stringify(scoredCandidates), 'EX', 900);
    } catch (e) {
      console.warn('Redis cache write failed:', e);
    }

    return scoredCandidates;
  }

  async precomputeMatchFeed(
    userId: string,
    options: {
      lat?: number;
      lng?: number;
      limit?: number;
      type?: 'user' | 'event';
    },
    workspaceId: string,
  ): Promise<void> {
    // Simple wrapper to run getMatchFeed and let it populate the cache
    // In a real system, this would be triggered by a worker or on location change
    await this.getMatchFeed(userId, options, workspaceId);
  }

  async handleSwipe(
    userId: string,
    targetId: string,
    targetType: 'user' | 'event',
    direction: 'left' | 'right' | 'up',
    workspaceId: string,
  ): Promise<void> {
    // 1. Safety Control: Rate Limiting (Step 2 Safety)
    // Limit to 60 swipes per minute to prevent botting/fatigue
    const rateLimit = await checkRateLimit(`swipe:${userId}`, 60, 60);
    if (!rateLimit.success) {
      throw new Error('Too many swipes. Please take a breather.');
    }

    const interaction: Interaction = {
      userId,
      targetId,
      targetType,
      type: 'swipe',
      direction,
      createdAt: new Date().toISOString(),
    };

    await this.matchingRepo.saveInteraction(interaction);

    // 2. Adaptive Adjustments (Step 3 Retention)
    // Store recent swipe preferences in Redis for session-based scoring boost
    if (direction === 'right' || direction === 'up') {
      await this.updateAdaptivePreferences(userId, targetId, targetType, workspaceId);
    }

    // Analytics instrumentation
    try {
      // @ts-ignore
      const { trackInteraction } = await import('../../../analytics-service.js');
      await trackInteraction(userId, targetId, 'swipe', { targetType, direction });
    } catch (e) {
      console.error('Analytics tracking failed:', e);
    }

    // Logic for "It's a Match!" can go here if two-way matching is needed
  }

  async checkMutualMatch(userId: string, targetId: string): Promise<boolean> {
    if (userId === targetId) return true; // Self is always a match

    try {
      // Check if A swiped right on B
      const interactionAB = await this.matchingRepo.getInteractedIds(userId, 'user');
      if (!interactionAB.includes(targetId)) return false;

      // Check if B swiped right on A
      const interactionBA = await this.matchingRepo.getInteractedIds(targetId, 'user');
      if (!interactionBA.includes(userId)) return false;

      return true;
    } catch (e) {
      console.error('Match check failed:', e);
      return false;
    }
  }

  async getMatchStatus(
    userId: string,
    targetId: string,
  ): Promise<{ isMatch: boolean; status: string }> {
    const isMatch = await this.checkMutualMatch(userId, targetId);

    // This could be expanded to check for "Pending", "Blocked", etc.
    return {
      isMatch,
      status: isMatch ? 'matched' : 'stranger',
    };
  }

  private async updateAdaptivePreferences(
    userId: string,
    targetId: string,
    targetType: 'user' | 'event',
    workspaceId: string,
  ): Promise<void> {
    const redis = getRedisClient();
    const prefKey = `user_prefs_boost:${userId}`;

    try {
      let targetGenres: string[] = [];
      if (targetType === 'event') {
        const event = await this.eventRepo.getById(targetId, workspaceId);
        if (event) {
          const { id: _, ...dataWithoutId } = event as any;
          targetGenres = dataWithoutId?.genres || [];
        }
      }

      for (const genre of targetGenres) {
        // Increment boost score for this genre (TTL 24h)
        await redis.zincrby(prefKey, 1, genre);
        await redis.expire(prefKey, 86400);
      }
    } catch (e) {
      console.error('Adaptive preference update failed:', e);
    }
  }

  private async getAdaptiveBoosts(userId: string): Promise<Record<string, number>> {
    const redis = getRedisClient();
    const prefKey = `user_prefs_boost:${userId}`;

    try {
      const boosts = await redis.zrevrange(prefKey, 0, -1, 'WITHSCORES');
      const boostMap: Record<string, number> = {};
      for (let i = 0; i < boosts.length; i += 2) {
        boostMap[boosts[i]] = parseFloat(boosts[i + 1]);
      }
      return boostMap;
    } catch (e) {
      return {};
    }
  }

  private calculateInterestScore(
    user: any,
    target: any,
    adaptiveBoosts: Record<string, number> = {},
  ): number {
    const userInterests = user.interests || user.genres || [];
    const targetTags = target.genres || target.tags || [];

    if (userInterests.length === 0 || targetTags.length === 0) return 0.5;

    let score = 0;
    const intersection = userInterests.filter((x: string) => targetTags.includes(x));
    score = intersection.length / Math.max(userInterests.length, 1);

    // Apply adaptive boost (Retention tuning)
    let boost = 0;
    for (const tag of targetTags) {
      if (adaptiveBoosts[tag]) {
        boost += Math.min(adaptiveBoosts[tag] * 0.1, 0.5); // Max 0.5 boost
      }
    }

    return Math.min(score + boost, 1.0);
  }

  private calculateProximityScore(lat?: number, lng?: number, target?: any): number {
    if (!lat || !lng || !target.coordinates) return 0.5;

    // Simple linear falloff: 1.0 at 0km, 0.0 at 50km
    const distance = this.haversine(
      lat,
      lng,
      target.coordinates.latitude,
      target.coordinates.longitude,
    );
    const maxDistance = 50;
    return Math.max(0, 1 - distance / maxDistance);
  }

  private calculateActivityScore(target: any): number {
    // High activity events (view count, ticket sales) get higher scores
    const views = target.stats?.views || 0;
    const sales = target.stats?.ticketsSold || 0;

    // Normalize (Assuming 1000 views or 100 sales as "high activity" for V1)
    const score = (Math.min(views, 1000) / 1000) * 0.5 + (Math.min(sales, 100) / 100) * 0.5;
    return score;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
