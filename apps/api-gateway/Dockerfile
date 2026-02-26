# Production Build for API Gateway
FROM node:20-alpine AS builder

WORKDIR /app

# Install turbo for pruning
RUN npm install -g turbo

COPY . .

# Prune the workspace for the api-gateway app
RUN turbo prune api-gateway --docker

# --- Build Stage ---
FROM node:20-alpine AS installer
WORKDIR /app

# First copy the pruned lockfile and package.json
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json

# Install dependencies (only what's needed for the pruned workspace)
RUN npm install

# Build the project
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
RUN npx turbo run build --filter=api-gateway

# --- Runner Stage ---
FROM node:20-alpine AS runner
WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs
USER nodejs

# Copy the built application and its dependencies
COPY --from=installer /app/apps/api-gateway/package.json ./package.json
COPY --from=installer /app/apps/api-gateway/dist ./dist
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/packages/core ./packages/core

# Environment defaults
ENV NODE_ENV production
ENV PORT 4000

EXPOSE 4000

CMD ["node", "dist/app.js"]
