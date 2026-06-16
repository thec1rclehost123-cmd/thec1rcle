FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune @c1rcle/mobile-app --docker

FROM node:20-alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app
# Copy the pruned lockfile and package.json
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
# Install dependencies
RUN npm install
# Copy the pruned source code
COPY --from=builder /app/out/full/ .

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache bash

# Copy the installer output (source + node_modules)
COPY --from=installer /app .

WORKDIR /app/apps/mobile-app

# Expose the default Expo port
EXPOSE 8081

# Start the Expo development server
CMD ["npx", "expo", "start"]
