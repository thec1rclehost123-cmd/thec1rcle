export class ProfileService {
    profileRepo;
    constructor(profileRepo) {
        this.profileRepo = profileRepo;
    }
    async getPublicProfile(id, type) {
        const profile = await this.profileRepo.getById(id, type);
        if (!profile)
            return null;
        const data = { ...profile };
        if (type === 'user') {
            delete data.email;
            delete data.phone;
        }
        return data;
    }
    async updateProfile(id, type, updates) {
        // Business logic like filtering safe updates can be moved here if we want to isolate 'profile-engine'
        await this.profileRepo.update(id, type, updates);
    }
    async createProfile(profile) {
        await this.profileRepo.create(profile);
    }
    async getPosts(id, type, limit) {
        return this.profileRepo.getPosts(id, type, limit);
    }
    async getHighlights(id, type) {
        return this.profileRepo.getHighlights(id, type);
    }
}
