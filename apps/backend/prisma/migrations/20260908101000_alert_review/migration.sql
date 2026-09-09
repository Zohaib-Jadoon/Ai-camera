ALTER TABLE "Alert"
ADD COLUMN "review_status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "reviewed_by" TEXT,
ADD COLUMN "reviewed_at" TIMESTAMP(3),
ADD COLUMN "review_note" TEXT;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_review_status_check"
CHECK ("review_status" IN ('PENDING', 'CONFIRMED', 'DISMISSED'));
