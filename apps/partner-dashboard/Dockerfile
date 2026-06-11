FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune @c1rcle/partner-dashboard --docker

FROM node:20-alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
COPY --from=builder /app/scripts/ ./scripts/
RUN --mount=type=cache,target=/root/.npm npm install --legacy-peer-deps
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
RUN npx turbo run build --filter=@c1rcle/partner-dashboard

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=installer /app/apps/partner-dashboard/public ./apps/partner-dashboard/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/partner-dashboard/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/partner-dashboard/.next/static ./apps/partner-dashboard/.next/static

USER nextjs
EXPOSE 3001
ENV PORT 3001
CMD ["node", "apps/partner-dashboard/server.js"]
