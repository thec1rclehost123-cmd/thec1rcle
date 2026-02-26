import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModerationService } from './src/domain/services/moderation-service.js';

const mockReportRepo = {
    save: vi.fn(),
    listByTarget: vi.fn(),
    updateStatus: vi.fn(),
};

describe('ModerationService', () => {
    let service: ModerationService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ModerationService(mockReportRepo as any);
    });

    describe('reportItem', () => {
        it('should save a new report with pending status', async () => {
            mockReportRepo.save.mockResolvedValue('r1');
            mockReportRepo.listByTarget.mockResolvedValue([]);

            const reportId = await service.reportItem({
                reporterId: 'u1',
                targetId: 'e1',
                targetType: 'event',
                reason: 'spam'
            });

            expect(reportId).toBe('r1');
            expect(mockReportRepo.save).toHaveBeenCalledWith(expect.objectContaining({
                status: 'pending',
                reason: 'spam'
            }));
        });

        it('should log warning when threshold is reached', async () => {
            const spy = vi.spyOn(console, 'log');
            mockReportRepo.listByTarget.mockResolvedValue([{}, {}, {}, {}, {}]);

            await service.reportItem({
                reporterId: 'u1',
                targetId: 'e1',
                targetType: 'event',
                reason: 'spam'
            });

            expect(spy).toHaveBeenCalledWith(expect.stringContaining('threshold'));
        });
    });

    describe('resolveReport', () => {
        it('should update report status', async () => {
            await service.resolveReport('r1', 'resolved');
            expect(mockReportRepo.updateStatus).toHaveBeenCalledWith('r1', 'resolved');
        });
    });
});
