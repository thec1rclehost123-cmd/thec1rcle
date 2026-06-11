FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune @c1rcle/guest-portal --docker

FROM node:20-alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
COPY --from=builder /app/scripts/ ./scripts/
RUN npm install --legacy-peer-deps
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
RUN npx turbo run build --filter=@c1rcle/guest-portal

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=installer /app/apps/guest-portal/public ./apps/guest-portal/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/guest-portal/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/guest-portal/.next/static ./apps/guest-portal/.next/static

USER nextjs
EXPOSE 3000
ENV PORT 3000
CMD ["node", "apps/guest-portal/server.js"]
