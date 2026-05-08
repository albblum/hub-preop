-- Prepare document-type-aware flow evolution without changing MVP enforcement.

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('constitutional', 'operational', 'institutional', 'generic');

-- AlterTable Instrument
ALTER TABLE "Instrument"
ADD COLUMN "documentType" "DocumentType" NOT NULL DEFAULT 'generic';

-- Keep local timestamp consistency with current Part model.
ALTER TABLE "Part" ALTER COLUMN "updatedAt" DROP DEFAULT;
