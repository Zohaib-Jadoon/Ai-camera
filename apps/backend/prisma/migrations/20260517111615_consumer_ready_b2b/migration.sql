-- AlterTable
ALTER TABLE "Camera" ADD COLUMN     "group_id" TEXT;

-- CreateTable
CREATE TABLE "CameraGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CameraGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "camera_id" TEXT,
    "zone_id" TEXT,
    "object_type" TEXT,
    "alert_type" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "schedule_mode" TEXT NOT NULL DEFAULT 'ALWAYS',
    "cooldown_sec" INTEGER NOT NULL DEFAULT 60,
    "actions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRuleSchedule" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRuleSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "resource_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT,
    "headers" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "alert_type" TEXT,
    "min_severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EscalationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalationStep" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "delay_min" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscalationStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_user_id_read_createdAt_idx" ON "Notification"("user_id", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "Camera" ADD CONSTRAINT "Camera_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "CameraGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "Camera"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRuleSchedule" ADD CONSTRAINT "AlertRuleSchedule_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationStep" ADD CONSTRAINT "EscalationStep_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "EscalationPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
