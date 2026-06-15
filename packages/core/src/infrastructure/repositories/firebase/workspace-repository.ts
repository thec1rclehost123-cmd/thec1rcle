import {
  IWorkspaceRepository,
  Workspace,
  WorkspacePlan,
  WorkspaceType,
  WorkspaceStatus,
} from '../../../domain/repositories/workspace-repository.js';
import type { Firestore } from 'firebase-admin/firestore';

export class FirebaseWorkspaceRepository implements IWorkspaceRepository {
  constructor(private db: Firestore) {}

  async getById(id: string): Promise<Workspace | null> {
    const doc = await this.db.collection('workspaces').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Workspace;
  }

  async getBySlug(slug: string): Promise<Workspace | null> {
    const snapshot = await this.db
      .collection('workspaces')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Workspace;
  }

  async create(workspace: Workspace): Promise<void> {
    await this.db.collection('workspaces').doc(workspace.id).set(workspace);
  }

  async update(id: string, updates: Partial<Workspace>): Promise<void> {
    await this.db.collection('workspaces').doc(id).update(updates);
  }

  async listByUser(userId: string): Promise<Workspace[]> {
    // This usually involves querying a memberships collection
    const snapshot = await this.db
      .collection('workspace_memberships')
      .where('userId', '==', userId)
      .get();

    const workspaceIds = snapshot.docs.map((doc) => doc.data().workspaceId);
    if (workspaceIds.length === 0) return [];

    const wsSnapshot = await this.db
      .collection('workspaces')
      .where('__name__', 'in', workspaceIds)
      .get();

    return wsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Workspace);
  }
}
