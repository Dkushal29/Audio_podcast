-- Add intermediate processing stages to ImportJobStatus enum
ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'VALIDATING';
ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'FETCHING';
ALTER TYPE "ImportJobStatus" ADD VALUE IF NOT EXISTS 'UPLOADING';
