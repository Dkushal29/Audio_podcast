-- Safe, idempotent upgrade script for existing EchoSpace PostgreSQL databases
-- created via `prisma db push` before Prisma migrations were introduced.
-- NOTE: Run Step 1 (ADD VALUE 'NOTE') outside a multi-statement transaction if on PG < 12,
-- and commit it BEFORE running the UPDATE on "Annotation".

ALTER TYPE "AnnotationCategory" ADD VALUE IF NOT EXISTS 'NOTE';
ALTER TYPE "EpisodeSourceType" ADD VALUE IF NOT EXISTS 'EXTERNAL_LINK';

-- After committing the enum value above, migrate legacy Study Mode categories without data loss:
UPDATE "Annotation"
SET category = 'NOTE'
WHERE category IN ('INSIGHT', 'REVISION');
