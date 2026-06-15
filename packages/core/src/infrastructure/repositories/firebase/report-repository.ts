import { IReportRepository, Report } from '../../../domain/repositories/report-repository.js';
import type { Firestore } from 'firebase-admin/firestore';

export class FirebaseReportRepository implements IReportRepository {
  constructor(private db: Firestore) {}

  async save(report: Report): Promise<string> {
    const docRef = await this.db.collection('reports').add({
      ...report,
      createdAt: report.createdAt || new Date().toISOString(),
    });
    return docRef.id;
  }

  async getById(id: string): Promise<Report | null> {
    const doc = await this.db.collection('reports').doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Report;
  }

  async listByTarget(targetId: string): Promise<Report[]> {
    const snapshot = await this.db
      .collection('reports')
      .where('targetId', '==', targetId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Report);
  }

  async updateStatus(id: string, status: Report['status']): Promise<void> {
    await this.db.collection('reports').doc(id).update({
      status,
      updatedAt: new Date().toISOString(),
    });
  }
}
