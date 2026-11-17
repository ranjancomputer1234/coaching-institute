-- AlterTable NotificationCampaign
ALTER TABLE "NotificationCampaign" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "NotificationCampaign" ADD COLUMN IF NOT EXISTS "actionLabel" TEXT;
ALTER TABLE "NotificationCampaign" ADD COLUMN IF NOT EXISTS "targetKind" TEXT;
ALTER TABLE "NotificationCampaign" ADD COLUMN IF NOT EXISTS "targetRef" TEXT;
ALTER TABLE "NotificationCampaign" ADD COLUMN IF NOT EXISTS "recipientCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable NotificationInboxItem
CREATE TABLE IF NOT EXISTS "NotificationInboxItem" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "campaignId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'system',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "actionLabel" TEXT,
    "targetKind" TEXT,
    "targetRef" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationInboxItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationInboxItem_campaignId_learnerId_key"
  ON "NotificationInboxItem"("campaignId", "learnerId");
CREATE INDEX IF NOT EXISTS "NotificationInboxItem_learnerId_createdAt_idx"
  ON "NotificationInboxItem"("learnerId", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationInboxItem_learnerId_read_idx"
  ON "NotificationInboxItem"("learnerId", "read");

DO $$ BEGIN
  ALTER TABLE "NotificationInboxItem" ADD CONSTRAINT "NotificationInboxItem_learnerId_fkey"
    FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationInboxItem" ADD CONSTRAINT "NotificationInboxItem_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "NotificationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
