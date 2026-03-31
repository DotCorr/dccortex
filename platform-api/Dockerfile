FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine AS runner
WORKDIR /app

# Install Docker CLI so the server can spawn build containers
RUN apk add --no-cache docker-cli

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Directory where built artifacts are stored (mounted as a volume in production)
RUN mkdir -p /tmp/dccortex-builds
ENV ARTIFACTS_DIR=/tmp/dccortex-builds

EXPOSE 3001
CMD ["node", "dist/index.js"]
