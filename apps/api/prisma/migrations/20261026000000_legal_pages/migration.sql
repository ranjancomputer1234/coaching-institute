-- Public legal pages (privacy, terms, refund, and other notices).
CREATE TABLE "LegalPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveAt" TIMESTAMP(3),
    "lifecycle" "ContentLifecycle" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalPage_slug_locale_version_key" ON "LegalPage"("slug", "locale", "version");
CREATE INDEX "LegalPage_slug_locale_lifecycle_idx" ON "LegalPage"("slug", "locale", "lifecycle");
