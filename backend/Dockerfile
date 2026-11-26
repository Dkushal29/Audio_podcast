FROM node:20-slim

# Install FFmpeg (for audio probing & extraction) and OpenSSL (for Prisma)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install production dependencies (prisma CLI is in dependencies, not devDependencies)
COPY package*.json ./
RUN npm ci --omit=dev

# 2. Copy Prisma schema + migrations, then generate the client
COPY prisma ./prisma
RUN npx prisma generate

# 3. Copy application source
COPY src ./src

ENV NODE_ENV=production
EXPOSE 8080

# On startup: apply any pending migrations, then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
