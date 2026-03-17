import { IWorkspaceRepository, Workspace } from '../../../domain/repositories/workspace-repository.js';
import type { Firestore } from 'firebase-admin/firestore';
export declare class FirebaseWorkspaceRepository implements IWorkspaceRepository {
    private db;
    constructor(db: Firestore);
    getById(id: string): Promise<Workspace | null>;
    getBySlug(slug: string): Promise<Workspace | null>;
    create(workspace: Workspace): Promise<void>;
    update(id: string, updates: Partial<Workspace>): Promise<void>;
    listByUser(userId: string): Promise<Workspace[]>;
}
