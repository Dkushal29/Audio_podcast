FROM node:20-slim

# Install FFmpeg (for audio probing & extraction) and OpenSSL (for Prisma)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

ENV NODE_ENV=production
EXPOSE 8080

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
