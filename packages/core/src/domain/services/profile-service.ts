import { IProfileRepository, Profile } from '../repositories/profile-repository.js';

export class ProfileService {
  constructor(private profileRepo: IProfileRepository) {}

  async getPublicProfile(
    id: string,
    type: 'user' | 'venue' | 'host',
    viewerId?: string,
    matchingService?: any,
  ): Promise<Partial<Profile> | null> {
    const profile = await this.profileRepo.getById(id, type);
    if (!profile) return null;

    const data = { ...profile };

    // Hide sensitive contact info for public responses
    if (type === 'user') {
      delete data.email;
      delete data.phone;
    }

    return data;
  }

  async updateProfile(
    id: string,
    type: 'user' | 'venue' | 'host',
    updates: Partial<Profile>,
  ): Promise<void> {
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
