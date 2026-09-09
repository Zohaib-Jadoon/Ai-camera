-- Reconcile the historical db-push-only binary column without removing data.
ALTER TABLE "Recording" ADD COLUMN IF NOT EXISTS "video_data" BYTEA;
ALTER TABLE "Recording" ALTER COLUMN "filepath" DROP NOT NULL;

ALTER TABLE "Recording"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'LEGACY',
ADD COLUMN "object_key" TEXT,
ADD COLUMN "sha256" TEXT,
ADD COLUMN "privacy_hash" TEXT,
ADD COLUMN "failure_code" TEXT;

ALTER TABLE "Recording" ADD CONSTRAINT "Recording_status_check"
CHECK ("status" IN ('LEGACY', 'RECORDING', 'UPLOADING', 'READY', 'FAILED'));
