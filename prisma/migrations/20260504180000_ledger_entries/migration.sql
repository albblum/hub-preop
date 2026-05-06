-- Passo B: conceptual append-only ledger per instrument (DocHUB alignment)

CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "previousEntryId" TEXT,
    "entryType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "idrRef" TEXT NOT NULL,
    "instrumentVersionId" TEXT,
    "transitionEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerEntry_instrumentId_sequence_key" ON "LedgerEntry"("instrumentId", "sequence");

CREATE UNIQUE INDEX "LedgerEntry_instrumentVersionId_key" ON "LedgerEntry"("instrumentVersionId");

CREATE UNIQUE INDEX "LedgerEntry_transitionEventId_key" ON "LedgerEntry"("transitionEventId");

CREATE INDEX "LedgerEntry_instrumentId_sequence_idx" ON "LedgerEntry"("instrumentId", "sequence");

CREATE INDEX "LedgerEntry_instrumentId_createdAt_idx" ON "LedgerEntry"("instrumentId", "createdAt");

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_previousEntryId_fkey" FOREIGN KEY ("previousEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_instrumentVersionId_fkey" FOREIGN KEY ("instrumentVersionId") REFERENCES "InstrumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_transitionEventId_fkey" FOREIGN KEY ("transitionEventId") REFERENCES "TransitionEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
