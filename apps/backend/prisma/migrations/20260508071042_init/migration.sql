-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SECURITY_OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "CameraStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Camera" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rtsp_url" TEXT NOT NULL,
    "status" "CameraStatus" NOT NULL DEFAULT 'OFFLINE',
    "location" TEXT,
    "snapshot_url" TEXT,
    "last_seen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Camera_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "name" TEXT,
    "polygon_points" JSONB NOT NULL,
    "rule_type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Detection" (
    "id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "snapshot_url" TEXT,

    CONSTRAINT "Detection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceEmbedding" (
    "id" TEXT NOT NULL,
    "person_id" TEXT NOT NULL,
    "embedding_vector" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceEvent" (
    "id" TEXT NOT NULL,
    "camera_id" TEXT NOT NULL,
    "person_id" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FaceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'PENDING',
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "camera_id" TEXT,
    "zone_id" TEXT,
    "assignee_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Detection_camera_id_idx" ON "Detection"("camera_id");

-- CreateIndex
CREATE INDEX "Detection_timestamp_idx" ON "Detection"("timestamp");

-- CreateIndex
CREATE INDEX "Detection_object_type_idx" ON "Detection"("object_type");

-- CreateIndex
CREATE INDEX "FaceEvent_camera_id_idx" ON "FaceEvent"("camera_id");

-- CreateIndex
CREATE INDEX "FaceEvent_timestamp_idx" ON "FaceEvent"("timestamp");

-- CreateIndex
CREATE INDEX "FaceEvent_person_id_idx" ON "FaceEvent"("person_id");

-- CreateIndex
CREATE INDEX "Alert_status_idx" ON "Alert"("status");

-- CreateIndex
CREATE INDEX "Alert_sent_at_idx" ON "Alert"("sent_at");

-- CreateIndex
CREATE INDEX "Alert_camera_id_idx" ON "Alert"("camera_id");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE INDEX "RefreshToken_user_id_idx" ON "RefreshToken"("user_id");

-- CreateIndex
CREATE INDEX "RefreshToken_token_idx" ON "RefreshToken"("token");

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Detection" ADD CONSTRAINT "Detection_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceEmbedding" ADD CONSTRAINT "FaceEmbedding_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceEvent" ADD CONSTRAINT "FaceEvent_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceEvent" ADD CONSTRAINT "FaceEvent_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "Camera"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
