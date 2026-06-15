export type WorkspaceType = 'hms' | 'edtech' | 'cms';
export type WorkspacePlan = 'basic' | 'pro' | 'enterprise';
export type WorkspaceStatus = 'active' | 'suspended' | 'trialing';

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  type: WorkspaceType;
  plan: WorkspacePlan;
  status: WorkspaceStatus;
  ownerId: string;
  features: string[];
  settings: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface IWorkspaceRepository {
  getById(id: string): Promise<Workspace | null>;
  getBySlug(slug: string): Promise<Workspace | null>;
  create(workspace: Workspace): Promise<void>;
  update(id: string, updates: Partial<Workspace>): Promise<void>;
  listByUser(userId: string): Promise<Workspace[]>;
}
