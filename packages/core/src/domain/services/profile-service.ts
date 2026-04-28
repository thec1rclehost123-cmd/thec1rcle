import { IProfileRepository, Profile } from '../repositories/profile-repository.js';

export class ProfileService {
    constructor(private profileRepo: IProfileRepository) { }

    async getPublicProfile(id: string, type: 'user' | 'venue' | 'host', viewerId?: string, matchingService?: any): Promise<Partial<Profile> | null> {
        const profile = await this.profileRepo.getById(id, type);
        if (!profile) return null;

        const data = { ...profile };

        // 🛡️ Phase 6: Ghost Profile Pattern
        if (type === 'user') {
            const isSelf = viewerId === id;
            let isMatch = false;

            if (viewerId && !isSelf && matchingService) {
                isMatch = await matchingService.checkMutualMatch(viewerId, id);
            }

            if (!isSelf && !isMatch) {
                // Redact PII for strangers
                return {
                    id: profile.id,
                    displayName: "Ghost Attendee",
                    photoURL: undefined,
                    avatar: undefined,
                    bio: "Identity hidden until mutual match.",
                    interests: profile.interests || [],
                    reputation: profile.reputation || 0,
                    isAnonymous: true
                };
            }

            // For owner or matched user, we only hide sensitive contact info by default
            delete data.email;
            delete data.phone;
        }

        return data;
    }

    async updateProfile(id: string, type: 'user' | 'venue' | 'host', updates: Partial<Profile>): Promise<void> {
        // Business logic like filtering safe updates can be moved here if we want to isolate 'profile-engine'
        await this.profileRepo.update(id, type, updates);
    }

    async createProfile(profile: Profile): Promise<void> {
        await this.profileRepo.create(profile);
    }

    async getPosts(id: string, type: string, limit: number): Promise<any[]> {
        return this.profileRepo.getPosts(id, type, limit);
    }

    async getHighlights(id: string, type: string): Promise<any[]> {
        return this.profileRepo.getHighlights(id, type);
    }
}
