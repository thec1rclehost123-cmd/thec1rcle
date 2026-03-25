function requireRuntimeSecret(name, developmentFallback) {
    const value = process.env[name];
    if (value) return value;

    const env = process.env.NODE_ENV || "development";
    if (env === "development" || env === "test") {
        return developmentFallback;
    }

    throw new Error(`${name} environment variable is required in production`);
}

export function getQrSecret() {
    return requireRuntimeSecret("QR_SECRET_KEY", "dev-only-qr-secret");
}

export default {
    getQrSecret,
};
