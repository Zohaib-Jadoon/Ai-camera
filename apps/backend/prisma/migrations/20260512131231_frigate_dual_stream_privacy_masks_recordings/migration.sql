-- AlterTable
ALTER TABLE "Camera" ADD COLUMN     "detect_url" TEXT,
ADD COLUMN     "record_url" TEXT,
ADD COLUMN     "sop_name" TEXT;

-- CreateTable
CREATE TABLE "PrivacyMask" (
    "id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "label" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivacyMask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "duration_sec" INTEGER,
    "size_bytes" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivacyMask_camera_id_idx" ON "PrivacyMask"("camera_id");

-- CreateIndex
CREATE INDEX "Recording_camera_id_idx" ON "Recording"("camera_id");

-- CreateIndex
CREATE INDEX "Recording_started_at_idx" ON "Recording"("started_at");

-- CreateIndex
CREATE INDEX "Recording_trigger_idx" ON "Recording"("trigger");

-- AddForeignKey
ALTER TABLE "PrivacyMask" ADD CONSTRAINT "PrivacyMask_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;
