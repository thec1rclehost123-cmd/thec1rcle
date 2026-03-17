export class WorkspaceService {
    workspaceRepo;
    constructor(workspaceRepo) {
        this.workspaceRepo = workspaceRepo;
    }
    async getWorkspace(id) {
        return this.workspaceRepo.getById(id);
    }
    async getWorkspaceBySlug(slug) {
        return this.workspaceRepo.getBySlug(slug);
    }
    async createWorkspace(userId, name, type, slug) {
        const workspace = {
            id: `ws_${Date.now()}`,
            slug,
            name,
            type,
            plan: 'basic',
            status: 'active',
            ownerId: userId,
            features: this.getDefaultFeatures(type),
            settings: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await this.workspaceRepo.create(workspace);
        return workspace;
    }
    async upgradePlan(id, plan) {
        await this.workspaceRepo.update(id, { plan, updatedAt: new Date().toISOString() });
    }
    async isFeatureEnabled(workspaceId, feature) {
        const workspace = await this.workspaceRepo.getById(workspaceId);
        if (!workspace || workspace.status !== 'active')
            return false;
        return workspace.features.includes(feature);
    }
    getDefaultFeatures(type) {
        switch (type) {
            case 'hms':
                return ['inventory', 'orders', 'staff', 'analytics'];
            case 'edtech':
                return ['students', 'courses', 'grading', 'analytics'];
            case 'cms':
                return ['content', 'media', 'seo', 'analytics'];
            default:
                return ['analytics'];
        }
    }
}
