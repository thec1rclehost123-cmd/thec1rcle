import { z } from 'zod';
export declare const config: {
    PORT: number;
    NODE_ENV: z.core.$InferEnumOutput<{
        development: "development";
        production: "production";
        test: "test";
    }>;
    FIREBASE_PROJECT_ID: string;
    REDIS_URL: string;
    QR_SECRET_KEY: string;
    FIREBASE_CLIENT_EMAIL?: string | undefined;
    FIREBASE_PRIVATE_KEY?: string | undefined;
    SENTRY_DSN?: string | undefined;
    RAZORPAY_KEY_ID?: string | undefined;
    RAZORPAY_KEY_SECRET?: string | undefined;
    FRONTEND_URLS?: string | undefined;
};
export declare const env: {
    PORT: number;
    NODE_ENV: z.core.$InferEnumOutput<{
        development: "development";
        production: "production";
        test: "test";
    }>;
    FIREBASE_PROJECT_ID: string;
    REDIS_URL: string;
    QR_SECRET_KEY: string;
    FIREBASE_CLIENT_EMAIL?: string | undefined;
    FIREBASE_PRIVATE_KEY?: string | undefined;
    SENTRY_DSN?: string | undefined;
    RAZORPAY_KEY_ID?: string | undefined;
    RAZORPAY_KEY_SECRET?: string | undefined;
    FRONTEND_URLS?: string | undefined;
};
//# sourceMappingURL=index.d.ts.map