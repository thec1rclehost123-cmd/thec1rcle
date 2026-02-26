import { IProfileRepository, Profile } from '../repositories/profile-repository.js';
export declare class ProfileService {
    private profileRepo;
    constructor(profileRepo: IProfileRepository);
    getPublicProfile(id: string, type: 'user' | 'venue' | 'host'): Promise<Partial<Profile> | null>;
    updateProfile(id: string, type: 'user' | 'venue' | 'host', updates: Partial<Profile>): Promise<void>;
    createProfile(profile: Profile): Promise<void>;
    getPosts(id: string, type: string, limit: number): Promise<any[]>;
    getHighlights(id: string, type: string): Promise<any[]>;
}
