export const config = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  NODE_ENV: process.env.NODE_ENV || "development",
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
};
