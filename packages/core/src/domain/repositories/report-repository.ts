export interface Report {
  id?: string;
  reporterId: string;
  targetId: string;
  targetType: 'user' | 'event';
  reason: string;
  details?: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface IReportRepository {
  save(report: Report): Promise<string>;
  getById(id: string): Promise<Report | null>;
  listByTarget(targetId: string): Promise<Report[]>;
  updateStatus(id: string, status: Report['status']): Promise<void>;
}
