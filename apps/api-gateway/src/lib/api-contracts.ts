import type { ApiErrorPayload, StandardErrorResponse } from '@c1rcle/types';

export function buildErrorResponse(payload: ApiErrorPayload): StandardErrorResponse {
    const error: ApiErrorPayload = {
        code: payload.code,
        message: payload.message,
    };

    if (payload.details && (Array.isArray(payload.details) ? payload.details.length > 0 : true)) {
        error.details = payload.details;
    }

    if (payload.requestId) {
        error.requestId = payload.requestId;
    }

    return { error };
}

export function buildValidationDetails(issues: Array<{ path?: Array<string | number>; message: string }> = []) {
    return issues.map((issue) => ({
        path: Array.isArray(issue.path) ? issue.path.join('.') : '',
        message: issue.message,
    }));
}
