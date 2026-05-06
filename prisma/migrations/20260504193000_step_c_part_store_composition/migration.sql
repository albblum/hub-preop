-- Step C: Part Store + Composition MVP (ADR 0003)

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "partKind" TEXT NOT NULL DEFAULT 'MONOLITH_BODY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartVersion" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "instrumentVersionId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositionEntry" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CompositionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Part_instrumentId_partKind_key" ON "Part"("instrumentId", "partKind");

-- CreateIndex
CREATE INDEX "Part_instrumentId_idx" ON "Part"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "PartVersion_instrumentVersionId_key" ON "PartVersion"("instrumentVersionId");

-- CreateIndex
CREATE INDEX "PartVersion_partId_idx" ON "PartVersion"("partId");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionEntry_instrumentId_position_key" ON "CompositionEntry"("instrumentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionEntry_instrumentId_partId_key" ON "CompositionEntry"("instrumentId", "partId");

-- CreateIndex
CREATE INDEX "CompositionEntry_instrumentId_idx" ON "CompositionEntry"("instrumentId");

-- AddForeignKey
ALTER TABLE "Part" ADD CONSTRAINT "Part_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartVersion" ADD CONSTRAINT "PartVersion_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartVersion" ADD CONSTRAINT "PartVersion_instrumentVersionId_fkey" FOREIGN KEY ("instrumentVersionId") REFERENCES "InstrumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionEntry" ADD CONSTRAINT "CompositionEntry_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionEntry" ADD CONSTRAINT "CompositionEntry_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;
