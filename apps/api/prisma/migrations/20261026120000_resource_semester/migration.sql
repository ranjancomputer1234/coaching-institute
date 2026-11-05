-- AlterTable
ALTER TABLE "Resource" ADD COLUMN "semesterId" TEXT;

-- CreateIndex
CREATE INDEX "Resource_semesterId_idx" ON "Resource"("semesterId");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "SemesterDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
