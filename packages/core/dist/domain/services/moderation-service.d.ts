import { IReportRepository, Report } from '../repositories/report-repository.js';
export declare class ModerationService {
    private reportRepo;
    constructor(reportRepo: IReportRepository);
    reportItem(report: Omit<Report, 'status' | 'createdAt'>): Promise<string>;
    getReportsForTarget(targetId: string): Promise<Report[]>;
    resolveReport(reportId: string, status: Report['status']): Promise<void>;
}
