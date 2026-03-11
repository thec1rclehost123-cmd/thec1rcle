"use client";

import { useReportWebVitals } from 'next/web-vitals';
import * as Sentry from '@sentry/nextjs';

export function WebVitals() {
    useReportWebVitals((metric) => {
        if (process.env.NODE_ENV !== 'production') return;

        // Send the custom vital to Sentry
        Sentry.metrics.distribution(metric.name, metric.value, {
            unit: metric.name === 'CLS' ? '' : 'millisecond',
        });
    });

    return null;
}
