-- Live class audience (batch + optional learner subset) and notify link.
ALTER TABLE "LiveClass" ADD COLUMN IF NOT EXISTS "batchId" TEXT;
ALTER TABLE "LiveClass" ADD COLUMN IF NOT EXISTS "audienceLearnerIdsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "LiveClass" ADD COLUMN IF NOT EXISTS "notifyCampaignId" TEXT;

CREATE INDEX IF NOT EXISTS "LiveClass_batchId_idx" ON "LiveClass"("batchId");
CREATE INDEX IF NOT EXISTS "LiveClass_startsAt_idx" ON "LiveClass"("startsAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LiveClass_batchId_fkey'
  ) THEN
    ALTER TABLE "LiveClass"
      ADD CONSTRAINT "LiveClass_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "Batch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
