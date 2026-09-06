# =====================================================================
# ITIS DEDICATED GPS TELEMETRY SERVER - DOCKERFILE
# Production-ready multi-stage container build
# =====================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json tsconfig.json ./
RUN npm install

# Copy server source code and compile
COPY src ./src
RUN npm run build

# =====================================================================
# Production Runtime Stage
# =====================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV TCP_PORT=5023
ENV UDP_PORT=5024
ENV HEALTH_PORT=8092

# Run as non-root user for security
USER node

# Copy built artifacts and production dependencies
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

# Non-privileged exposed ports:
# 5023/tcp - Tracker TCP telemetry
# 5024/udp - Tracker UDP telemetry
# 8092/tcp - Safe health status diagnostics
EXPOSE 5023/tcp 5024/udp 8092/tcp

# Internal healthcheck probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8092/health || exit 1

# Start the standalone dedicated telemetry server
CMD ["node", "dist/index.js"]
