# Stage 1: Install production dependencies
FROM node:20-alpine AS builder
WORKDIR /app/backend
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Runtime image (non-root)
FROM node:20-alpine AS runner
RUN apk add --no-cache tzdata
ENV NODE_ENV=production
ENV TZ=Asia/Jakarta
WORKDIR /app/backend

COPY --from=builder --chown=node:node /app/backend/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node seed.js ./seed.js

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]

