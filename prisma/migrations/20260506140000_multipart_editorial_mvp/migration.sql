-- AlterTable: per-Part markdown (ADR 0008)
ALTER TABLE "PartVersion" ADD COLUMN "markdownBody" TEXT;

-- DropIndex: allow multiple PartVersion rows per InstrumentVersion (one per Part)
DROP INDEX "PartVersion_instrumentVersionId_key";

-- CreateIndex: one PartVersion row per (instrument revision, Part)
CREATE UNIQUE INDEX "PartVersion_instrumentVersionId_partId_key" ON "PartVersion"("instrumentVersionId", "partId");
