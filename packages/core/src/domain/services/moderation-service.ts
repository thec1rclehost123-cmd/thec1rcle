import { IReportRepository, Report } from '../repositories/report-repository.js';

export class ModerationService {
  constructor(private reportRepo: IReportRepository) {}

  async reportItem(report: Omit<Report, 'status' | 'createdAt'>): Promise<string> {
    const fullReport: Report = {
      ...report,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const reportId = await this.reportRepo.save(fullReport);

    return reportId;
  }

  async getReportsForTarget(targetId: string): Promise<Report[]> {
    return await this.reportRepo.listByTarget(targetId);
  }

  async resolveReport(reportId: string, status: Report['status']): Promise<void> {
    await this.reportRepo.updateStatus(reportId, status);
  }
}
