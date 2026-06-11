FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
RUN npm install -g turbo
WORKDIR /app
COPY . .
RUN turbo prune @c1rcle/admin-console --docker

FROM node:20-alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
COPY --from=builder /app/scripts/ ./scripts/
RUN npm install --legacy-peer-deps
COPY --from=builder /app/out/full/ .
COPY turbo.json turbo.json
RUN npx turbo run build --filter=@c1rcle/admin-console

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=installer /app/apps/admin-console/public ./apps/admin-console/public
COPY --from=installer --chown=nextjs:nodejs /app/apps/admin-console/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/admin-console/.next/static ./apps/admin-console/.next/static

USER nextjs
EXPOSE 3002
ENV PORT 3002
CMD ["node", "apps/admin-console/server.js"]
