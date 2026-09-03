# ==============================================================================
# ITIS GPS TELEMETRY SERVER — DOCKERFILE
# Multi-stage production container build for independent deployment
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Compile TypeScript
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package.json package-lock.json* ./

# Install dependencies (including devDependencies required for compilation)
RUN npm ci || npm install

# Copy source tree and configuration
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript into ./dist
RUN npm run build

# Strip devDependencies to keep container lean
RUN npm prune --production

# ------------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV TCP_PORT=5000
ENV UDP_PORT=5001
ENV TELEMETRY_STORAGE_MODE=memory

# Install curl for robust health check diagnostics
RUN apk add --no-cache curl

# Security: Run as non-root user
USER node

# Copy compiled artifacts and production dependencies
COPY --chown=node:node --from=builder /app/package.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

# Ports exposed:
# - 8080/tcp: HTTP REST API & Container Healthcheck
# - 5000/tcp: Hardware GPS Tracker Persistent TCP Sockets
# - 5001/udp: Hardware GPS Tracker UDP Datagrams
EXPOSE 8080/tcp 5000/tcp 5001/udp

# Health check monitoring using the native GET /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Launch Server Entry Point
CMD ["node", "dist/server/index.js"]
