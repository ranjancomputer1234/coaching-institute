-- Managed video provider fields (Mux). Nullable: existing storage-key assets are unaffected.
ALTER TABLE "MediaAsset" ADD COLUMN "provider" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "providerUploadId" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "providerAssetId" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "providerPlaybackId" TEXT;
ALTER TABLE "MediaAsset" ADD COLUMN "providerStatus" TEXT;

CREATE UNIQUE INDEX "MediaAsset_providerUploadId_key" ON "MediaAsset"("providerUploadId");
CREATE UNIQUE INDEX "MediaAsset_providerAssetId_key" ON "MediaAsset"("providerAssetId");
CREATE UNIQUE INDEX "MediaAsset_providerPlaybackId_key" ON "MediaAsset"("providerPlaybackId");
