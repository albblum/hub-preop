-- Phase 3: Core Registry (replaces InstrumentStub; pilot note: prior stub rows are dropped)
DROP TABLE "InstrumentStub";

-- CreateTable
CREATE TABLE "IdrSequence" (
    "key" TEXT NOT NULL DEFAULT 'instrument',
    "next" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "IdrSequence_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "idrRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "layer" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "draftingAuthority" TEXT,
    "currentVersion" INTEGER NOT NULL,
    "parentInstrumentId" TEXT,
    "currentVersionRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentVersion" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "supersedesVersion" INTEGER,
    "revisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstrumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransitionEvent" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT,
    "note" TEXT,

    CONSTRAINT "TransitionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_idrRef_key" ON "Instrument"("idrRef");

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_currentVersionRecordId_key" ON "Instrument"("currentVersionRecordId");

-- CreateIndex
CREATE INDEX "Instrument_layer_idx" ON "Instrument"("layer");

-- CreateIndex
CREATE INDEX "Instrument_status_idx" ON "Instrument"("status");

-- CreateIndex
CREATE INDEX "InstrumentVersion_instrumentId_idx" ON "InstrumentVersion"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentVersion_instrumentId_version_key" ON "InstrumentVersion"("instrumentId", "version");

-- CreateIndex
CREATE INDEX "TransitionEvent_instrumentId_at_idx" ON "TransitionEvent"("instrumentId", "at");

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_parentInstrumentId_fkey" FOREIGN KEY ("parentInstrumentId") REFERENCES "Instrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_currentVersionRecordId_fkey" FOREIGN KEY ("currentVersionRecordId") REFERENCES "InstrumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentVersion" ADD CONSTRAINT "InstrumentVersion_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransitionEvent" ADD CONSTRAINT "TransitionEvent_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
