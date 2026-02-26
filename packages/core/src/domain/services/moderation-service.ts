import { IReportRepository, Report } from '../repositories/report-repository.js';

export class ModerationService {
    constructor(private reportRepo: IReportRepository) { }

    async reportItem(report: Omit<Report, 'status' | 'createdAt'>): Promise<string> {
        const fullReport: Report = {
            ...report,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        const reportId = await this.reportRepo.save(fullReport);

        // Check for threshold-based auto-moderation (Step 1 Safety)
        const recentReports = await this.reportRepo.listByTarget(report.targetId);
        if (recentReports.length >= 5) {
            // Placeholder: Auto-flag or notify moderators
            console.log(`[MODERATION] Item ${report.targetId} has reached report threshold (${recentReports.length})`);
        }

        return reportId;
    }

    async getReportsForTarget(targetId: string): Promise<Report[]> {
        return await this.reportRepo.listByTarget(targetId);
    }

    async resolveReport(reportId: string, status: Report['status']): Promise<void> {
        await this.reportRepo.updateStatus(reportId, status);
    }
}
