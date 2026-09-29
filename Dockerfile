# syntax=docker/dockerfile:1

###############################################################################
# Stage 1 — dependencies (needs devDependencies: Tailwind runs at build time)
###############################################################################
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

###############################################################################
# Stage 2 — build the Next.js app (output: 'standalone')
###############################################################################
FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

###############################################################################
# Stage 3 — runtime: only the standalone server, its traced deps, and assets
###############################################################################
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    OBJEX_CONFIG_PATH=/app/data/objex-config.json

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs objex

# Holds the connection saved from the UI (service account key included), so
# mount a volume here to keep it across container restarts.
RUN mkdir -p /app/data && chown objex:nodejs /app/data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=objex:nodejs /app/.next/standalone ./
COPY --from=builder --chown=objex:nodejs /app/.next/static ./.next/static

USER objex
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

# server.js is emitted by Next's standalone output.
CMD ["node", "server.js"]
