-- Phase 4: integrity hashes, version chain, actor enrichment, export manifests

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "ActorKind" AS ENUM ('human', 'system', 'api_key');

-- AlterTable InstrumentVersion
ALTER TABLE "InstrumentVersion" ADD COLUMN "contentHash" TEXT,
ADD COLUMN "previousContentHash" TEXT;

-- Backfill contentHash (canonical: version || E'\n' || content, UTF-8, SHA-256 hex)
UPDATE "InstrumentVersion"
SET "contentHash" = encode(digest("version"::text || E'\n' || "content", 'sha256'), 'hex');

-- Chain: previous row's contentHash per instrument ordered by version
WITH lagged AS (
  SELECT
    id,
    LAG("contentHash") OVER (
      PARTITION BY "instrumentId"
      ORDER BY "version"
    ) AS prev_hash
  FROM "InstrumentVersion"
)
UPDATE "InstrumentVersion" iv
SET "previousContentHash" = lagged.prev_hash
FROM lagged
WHERE iv.id = lagged.id;

ALTER TABLE "InstrumentVersion" ALTER COLUMN "contentHash" SET NOT NULL;

-- AlterTable TransitionEvent
ALTER TABLE "TransitionEvent"
ADD COLUMN "actorKind" "ActorKind" NOT NULL DEFAULT 'system',
ADD COLUMN "actorLabel" TEXT,
ADD COLUMN "actorExternalId" TEXT;

UPDATE "TransitionEvent"
SET "actorLabel" = "actor"
WHERE "actor" IS NOT NULL AND "actorLabel" IS NULL;

UPDATE "TransitionEvent"
SET "actorKind" = 'human'
WHERE "actor" IS NOT NULL;

-- CreateTable ExportManifest
CREATE TABLE "ExportManifest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scopeDescription" TEXT NOT NULL,
    "requestedBy" TEXT,
    "contentHash" TEXT NOT NULL,
    "exportSchemaVersion" TEXT NOT NULL DEFAULT '1',

    CONSTRAINT "ExportManifest_pkey" PRIMARY KEY ("id")
);
