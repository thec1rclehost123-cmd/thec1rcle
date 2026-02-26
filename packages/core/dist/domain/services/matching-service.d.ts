import { IMatchingRepository } from '../repositories/matching-repository.js';
import { IProfileRepository } from '../repositories/profile-repository.js';
import { IEventRepository } from '../repositories/event-repository.js';
export declare class MatchingService {
    private matchingRepo;
    private profileRepo;
    private eventRepo;
    constructor(matchingRepo: IMatchingRepository, profileRepo: IProfileRepository, eventRepo: IEventRepository);
    getMatchFeed(userId: string, options: {
        lat?: number;
        lng?: number;
        limit?: number;
        type?: 'user' | 'event';
    }): Promise<any[]>;
    precomputeMatchFeed(userId: string, options: {
        lat?: number;
        lng?: number;
        limit?: number;
        type?: 'user' | 'event';
    }): Promise<void>;
    handleSwipe(userId: string, targetId: string, targetType: 'user' | 'event', direction: 'left' | 'right' | 'up'): Promise<void>;
    private updateAdaptivePreferences;
    private getAdaptiveBoosts;
    private calculateInterestScore;
    private calculateProximityScore;
    private calculateActivityScore;
    private haversine;
}
