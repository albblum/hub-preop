-- CreateEnum
CREATE TYPE "ExternalReferenceKind" AS ENUM ('normative', 'technical', 'legal', 'economic');

-- CreateEnum
CREATE TYPE "ExternalReferenceLifecycleStatus" AS ENUM ('active', 'outdated', 'revoked');

-- AlterTable Instrument
ALTER TABLE "Instrument" ADD COLUMN "committeeId" TEXT,
ADD COLUMN "consultationClosesAt" TIMESTAMP(3),
ADD COLUMN "consultationOpeningNote" TEXT;

-- CreateIndex
CREATE INDEX "Instrument_committeeId_idx" ON "Instrument"("committeeId");

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "ExternalReference" (
    "id" TEXT NOT NULL,
    "kind" "ExternalReferenceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL,
    "status" "ExternalReferenceLifecycleStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentExternalReference" (
    "instrumentId" TEXT NOT NULL,
    "externalReferenceId" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstrumentExternalReference_pkey" PRIMARY KEY ("instrumentId","externalReferenceId")
);

-- CreateIndex
CREATE INDEX "ExternalReference_kind_idx" ON "ExternalReference"("kind");

-- CreateIndex
CREATE INDEX "ExternalReference_stableId_idx" ON "ExternalReference"("stableId");

-- CreateIndex
CREATE INDEX "InstrumentExternalReference_externalReferenceId_idx" ON "InstrumentExternalReference"("externalReferenceId");

-- AddForeignKey
ALTER TABLE "InstrumentExternalReference" ADD CONSTRAINT "InstrumentExternalReference_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentExternalReference" ADD CONSTRAINT "InstrumentExternalReference_externalReferenceId_fkey" FOREIGN KEY ("externalReferenceId") REFERENCES "ExternalReference"("id") ON DELETE CASCADE ON UPDATE CASCADE;
