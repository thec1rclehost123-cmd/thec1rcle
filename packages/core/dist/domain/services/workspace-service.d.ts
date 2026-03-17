import { IWorkspaceRepository, Workspace, WorkspacePlan, WorkspaceType } from '../repositories/workspace-repository.js';
export declare class WorkspaceService {
    private workspaceRepo;
    constructor(workspaceRepo: IWorkspaceRepository);
    getWorkspace(id: string): Promise<Workspace | null>;
    getWorkspaceBySlug(slug: string): Promise<Workspace | null>;
    createWorkspace(userId: string, name: string, type: WorkspaceType, slug: string): Promise<Workspace>;
    upgradePlan(id: string, plan: WorkspacePlan): Promise<void>;
    isFeatureEnabled(workspaceId: string, feature: string): Promise<boolean>;
    private getDefaultFeatures;
}
