-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "alert_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "alert_message" TEXT,
ADD COLUMN     "photo_url" TEXT;
