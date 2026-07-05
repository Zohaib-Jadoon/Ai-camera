-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "oauth_id" TEXT,
ADD COLUMN     "oauth_provider" TEXT;

-- CreateIndex
CREATE INDEX "User_oauth_provider_oauth_id_idx" ON "User"("oauth_provider", "oauth_id");
