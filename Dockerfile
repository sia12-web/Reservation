# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy backend package files
COPY package*.json ./
COPY prisma ./prisma/

# Install backend dependencies
RUN npm ci

# Copy frontend package files and install dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY src ./src/
COPY frontend ./frontend/

# Build TypeScript backend and React frontend
RUN npm run build
RUN cd frontend && npm run build

# Production stage
FROM node:20-slim AS production

WORKDIR /app

# Install OpenSSL for Prisma and wget for healthcheck
RUN apt-get update -y && apt-get install -y openssl wget && rm -rf /var/lib/apt/lists/*

# Copy package files and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies
RUN npm ci --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application using the correct script
CMD ["npm", "run", "start"]
