import { IWorkspaceRepository, Workspace, WorkspacePlan, WorkspaceType } from '../repositories/workspace-repository.js';

export class WorkspaceService {
    constructor(private workspaceRepo: IWorkspaceRepository) { }

    async getWorkspace(id: string): Promise<Workspace | null> {
        return this.workspaceRepo.getById(id);
    }

    async getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
        return this.workspaceRepo.getBySlug(slug);
    }

    async createWorkspace(userId: string, name: string, type: WorkspaceType, slug: string): Promise<Workspace> {
        const workspace: Workspace = {
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

    async upgradePlan(id: string, plan: WorkspacePlan): Promise<void> {
        await this.workspaceRepo.update(id, { plan, updatedAt: new Date().toISOString() });
    }

    async isFeatureEnabled(workspaceId: string, feature: string): Promise<boolean> {
        const workspace = await this.workspaceRepo.getById(workspaceId);
        if (!workspace || workspace.status !== 'active') return false;
        
        return workspace.features.includes(feature);
    }

    private getDefaultFeatures(type: WorkspaceType): string[] {
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
