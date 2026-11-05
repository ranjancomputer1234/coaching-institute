-- AlterTable Course
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;

-- CreateTable Exam
CREATE TABLE IF NOT EXISTS "Exam" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "description" TEXT,
    "commercialMode" "CourseCommercialMode" NOT NULL DEFAULT 'free',
    "iconKey" TEXT,
    "themeKey" TEXT,
    "imageUrl" TEXT,
    "learnerCount" INTEGER NOT NULL DEFAULT 0,
    "relatedExamsJson" TEXT NOT NULL DEFAULT '[]',
    "lifecycle" "ContentLifecycle" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Exam_lifecycle_idx" ON "Exam"("lifecycle");

-- AlterTable Test
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "examId" TEXT;
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "pricing" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "marking" TEXT NOT NULL DEFAULT '+1';
ALTER TABLE "Test" ADD COLUMN IF NOT EXISTS "negativeMarkingLabel" TEXT;

CREATE INDEX IF NOT EXISTS "Test_examId_lifecycle_idx" ON "Test"("examId", "lifecycle");

DO $$ BEGIN
  ALTER TABLE "Test" ADD CONSTRAINT "Test_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- LiveClassStatus enum extensions
DO $$ BEGIN
  ALTER TYPE "LiveClassStatus" ADD VALUE IF NOT EXISTS 'starting';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE "LiveClassStatus" ADD VALUE IF NOT EXISTS 'reconnecting';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable ContentCategory
CREATE TABLE IF NOT EXISTS "ContentCategory" (
    "id" TEXT NOT NULL,
    "kind" "EditorialKind" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "pricing" TEXT NOT NULL DEFAULT 'free',
    "commercialMode" "CourseCommercialMode" NOT NULL DEFAULT 'free',
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "lifecycle" "ContentLifecycle" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCategory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContentCategory_kind_lifecycle_idx" ON "ContentCategory"("kind", "lifecycle");

-- Expand EditorialItem
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "pricing" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "commercialMode" "CourseCommercialMode" NOT NULL DEFAULT 'free';
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "iconKey" TEXT;
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "byline" TEXT;
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "readingMinutes" INTEGER;
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "tagsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "highlightsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "reactionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "quizId" TEXT;
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "schema" TEXT;
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "summaryChipsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "entriesJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "prompt" TEXT;
ALTER TABLE "EditorialItem" ADD COLUMN IF NOT EXISTS "modelAnswer" TEXT;

CREATE INDEX IF NOT EXISTS "EditorialItem_categoryId_idx" ON "EditorialItem"("categoryId");
CREATE INDEX IF NOT EXISTS "EditorialItem_featured_publishedAt_idx" ON "EditorialItem"("featured", "publishedAt");

DO $$ BEGIN
  ALTER TABLE "EditorialItem" ADD CONSTRAINT "EditorialItem_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "ContentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- FactReaction
CREATE TABLE IF NOT EXISTS "FactReaction" (
    "id" TEXT NOT NULL,
    "factId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "reacted" BOOLEAN NOT NULL DEFAULT false,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FactReaction_factId_learnerId_key" ON "FactReaction"("factId", "learnerId");
CREATE INDEX IF NOT EXISTS "FactReaction_learnerId_idx" ON "FactReaction"("learnerId");

DO $$ BEGIN
  ALTER TABLE "FactReaction" ADD CONSTRAINT "FactReaction_factId_fkey"
    FOREIGN KEY ("factId") REFERENCES "EditorialItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "FactReaction" ADD CONSTRAINT "FactReaction_learnerId_fkey"
    FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- LiveClass extras
ALTER TABLE "LiveClass" ADD COLUMN IF NOT EXISTS "playbackUrl" TEXT;
ALTER TABLE "LiveClass" ADD COLUMN IF NOT EXISTS "viewerCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "LiveClassReminder" (
    "id" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveClassReminder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveClassReminder_liveClassId_learnerId_key"
  ON "LiveClassReminder"("liveClassId", "learnerId");

DO $$ BEGIN
  ALTER TABLE "LiveClassReminder" ADD CONSTRAINT "LiveClassReminder_liveClassId_fkey"
    FOREIGN KEY ("liveClassId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "LiveClassReminder" ADD CONSTRAINT "LiveClassReminder_learnerId_fkey"
    FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "LiveClassHand" (
    "id" TEXT NOT NULL,
    "liveClassId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "raised" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveClassHand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LiveClassHand_liveClassId_learnerId_key"
  ON "LiveClassHand"("liveClassId", "learnerId");

DO $$ BEGIN
  ALTER TABLE "LiveClassHand" ADD CONSTRAINT "LiveClassHand_liveClassId_fkey"
    FOREIGN KEY ("liveClassId") REFERENCES "LiveClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "LiveClassHand" ADD CONSTRAINT "LiveClassHand_learnerId_fkey"
    FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
