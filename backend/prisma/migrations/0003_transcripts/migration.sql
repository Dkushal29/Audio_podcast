-- Create TranscriptionStatus enum and Transcript table
CREATE TYPE "TranscriptionStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TABLE "Transcript" (
  "id" UUID NOT NULL,
  "episodeId" UUID NOT NULL,
  "workspaceId" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'deepgram',
  "model" TEXT NOT NULL DEFAULT 'nova-2',
  "language" TEXT NOT NULL DEFAULT 'en',
  "detectedLanguage" TEXT,
  "status" "TranscriptionStatus" NOT NULL DEFAULT 'QUEUED',
  "fullText" TEXT NOT NULL DEFAULT '',
  "segments" JSONB,
  "speakers" JSONB,
  "settings" JSONB,
  "confidence" DOUBLE PRECISION,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Transcript_episodeId_key" UNIQUE ("episodeId"),
  CONSTRAINT "Transcript_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Transcript_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Transcript_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Transcript_workspaceId_status_idx" ON "Transcript"("workspaceId", "status");
CREATE INDEX "Transcript_episodeId_idx" ON "Transcript"("episodeId");
