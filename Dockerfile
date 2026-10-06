# Angel Investor Survey — Railway Dockerfile

# Build stage: compile the frontend assets if any. We serve a static
# frontend from the same Node process, so no build step is required.
FROM node:22-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Production image
FROM node:22-alpine

WORKDIR /app

# Install production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the built server
COPY server.js .
COPY public/ ./public/

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + process.env.PORT || 3000, (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })" || exit 1

EXPOSE 3000

CMD ["node", "server.js"]
