import { describe, expect, it } from 'vitest';
import { buildErrorResponse, buildValidationDetails } from './api-contracts';

describe('api-contracts', () => {
    it('builds the standard nested error response shape', () => {
        expect(buildErrorResponse({
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
            requestId: 'req_123',
        })).toEqual({
            error: {
                code: 'FORBIDDEN',
                message: 'Insufficient permissions',
                requestId: 'req_123',
            },
        });
    });

    it('normalizes zod issues into path/message pairs', () => {
        expect(buildValidationDetails([
            { path: ['body', 'items', 0, 'tierId'], message: 'Required' },
        ])).toEqual([
            { path: 'body.items.0.tierId', message: 'Required' },
        ]);
    });
});

