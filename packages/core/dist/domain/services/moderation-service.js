export class ModerationService {
    reportRepo;
    constructor(reportRepo) {
        this.reportRepo = reportRepo;
    }
    async reportItem(report) {
        const fullReport = {
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
    async getReportsForTarget(targetId) {
        return await this.reportRepo.listByTarget(targetId);
    }
    async resolveReport(reportId, status) {
        await this.reportRepo.updateStatus(reportId, status);
    }
}
