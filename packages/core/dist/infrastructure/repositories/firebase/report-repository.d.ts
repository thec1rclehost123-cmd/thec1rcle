import { IReportRepository, Report } from '../../../domain/repositories/report-repository.js';
import type { Firestore } from 'firebase-admin/firestore';
export declare class FirebaseReportRepository implements IReportRepository {
    private db;
    constructor(db: Firestore);
    save(report: Report): Promise<string>;
    getById(id: string): Promise<Report | null>;
    listByTarget(targetId: string): Promise<Report[]>;
    updateStatus(id: string, status: Report['status']): Promise<void>;
}
