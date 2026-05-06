-- Step D: Part status two-level MVP (ADR 0004)

-- AlterTable
ALTER TABLE "Part" ADD COLUMN "partStatus" TEXT NOT NULL DEFAULT 'DRAFT';

-- Backfill MONOLITH_BODY Part rows from Instrument.status (deterministic map)
UPDATE "Part" AS p
SET "partStatus" = CASE i.status
    WHEN 'draft' THEN 'DRAFT'
    WHEN 'under-review' THEN 'PROPOSED'
    WHEN 'foundational-provisional' THEN 'PROVISIONAL'
    WHEN 'in-force' THEN 'PROVISIONAL'
    WHEN 'amended' THEN 'SUPERSEDED'
    WHEN 'suspended' THEN 'SUSPENDED'
    WHEN 'revoked' THEN 'REVOKED'
    WHEN 'derivation-pending' THEN 'DERIVATION_PENDING'
    WHEN 'normalization-pending' THEN 'NORMALIZATION_PENDING'
    ELSE 'DRAFT'
END
FROM "Instrument" AS i
WHERE p."instrumentId" = i.id;
