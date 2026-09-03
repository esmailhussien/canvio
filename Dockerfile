# -----------------------------------------------------------------------------
# Canvio Production Multi-Stage Containerfile
# Single-node combined deployment: Fastify API + Yjs WebSockets + Static Assets
# -----------------------------------------------------------------------------

# Stage 1: Dependencies Resolution
FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/ui/package.json ./packages/ui/
COPY packages/objects/package.json ./packages/objects/
COPY packages/collaboration/package.json ./packages/collaboration/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

RUN npm ci

# Stage 2: Workspace Build & SSG Prerendering
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
RUN npm run build

# Stage 3: Minimal Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    CANVIO_DATA_DIR=/app/data \
    CANVIO_STATIC_DIR=/app/apps/web/dist

RUN apk add --no-cache wget && \
    mkdir -p /app/data && \
    chown -R node:node /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

USER node

EXPOSE 4000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:4000/health || exit 1

CMD ["node", "apps/server/dist/combined-server.js"]
