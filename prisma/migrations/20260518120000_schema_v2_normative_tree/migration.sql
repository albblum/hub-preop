-- CreateEnum
CREATE TYPE "StructuralProfile" AS ENUM ('v1', 'v2');

-- CreateEnum
CREATE TYPE "NormativeMigrationPhase" AS ENUM ('pilot', 'deferred', 'complete');

-- CreateEnum
CREATE TYPE "IdrRefOwnerKind" AS ENUM ('instrument', 'section', 'article', 'paragraph', 'clause');

-- CreateEnum
CREATE TYPE "InstrumentVersionContentSource" AS ENUM ('legacy_primary', 'derived');

-- CreateEnum
CREATE TYPE "TerminationAuthorizedBy" AS ENUM ('secretary_general');

-- AlterTable
ALTER TABLE "Instrument" ADD COLUMN     "isAnnex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "semanticDocumentCode" TEXT,
ADD COLUMN     "structuralProfile" "StructuralProfile" NOT NULL DEFAULT 'v1',
ADD COLUMN     "terminationAuthorizedBy" "TerminationAuthorizedBy",
ADD COLUMN     "terminationConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "terminationDate" DATE,
ADD COLUMN     "terminationRequiresExplicitAct" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InstrumentVersion" ADD COLUMN     "contentSourceKind" "InstrumentVersionContentSource" NOT NULL DEFAULT 'legacy_primary';

-- CreateTable
CREATE TABLE "NormativeSection" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "nonNormative" BOOLEAN NOT NULL DEFAULT false,
    "migrationPhase" "NormativeMigrationPhase",
    "publishedAt" TIMESTAMP(3),
    "supersededBySectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormativeSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormativeArticle" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "articleCode" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormativeArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormativeParagraph" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "paragraphCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormativeParagraph_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormativeClause" (
    "id" TEXT NOT NULL,
    "paragraphId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "clauseCode" TEXT NOT NULL,
    "idrRef" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "supersededByClauseId" TEXT,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormativeClause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClauseVersion" (
    "id" TEXT NOT NULL,
    "clauseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "previousContentHash" TEXT,
    "revisionNote" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "ClauseVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdrRefRegistry" (
    "idrRef" TEXT NOT NULL,
    "ownerKind" "IdrRefOwnerKind" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "grammarVersion" TEXT NOT NULL DEFAULT '1',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdrRefRegistry_pkey" PRIMARY KEY ("idrRef")
);

-- CreateTable
CREATE TABLE "IdrRefAlias" (
    "legacyRef" TEXT NOT NULL,
    "canonicalRef" TEXT NOT NULL,
    "ownerKind" "IdrRefOwnerKind",
    "ownerId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdrRefAlias_pkey" PRIMARY KEY ("legacyRef")
);

-- CreateTable
CREATE TABLE "InstrumentRevision" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "aggregateContentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstrumentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstrumentRevisionClauseVersion" (
    "instrumentRevisionId" TEXT NOT NULL,
    "clauseVersionId" TEXT NOT NULL,

    CONSTRAINT "InstrumentRevisionClauseVersion_pkey" PRIMARY KEY ("instrumentRevisionId","clauseVersionId")
);

-- CreateIndex
CREATE INDEX "NormativeSection_instrumentId_idx" ON "NormativeSection"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "NormativeSection_instrumentId_position_key" ON "NormativeSection"("instrumentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "NormativeSection_instrumentId_code_key" ON "NormativeSection"("instrumentId", "code");

-- CreateIndex
CREATE INDEX "NormativeArticle_sectionId_idx" ON "NormativeArticle"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "NormativeArticle_sectionId_position_key" ON "NormativeArticle"("sectionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "NormativeArticle_sectionId_articleCode_key" ON "NormativeArticle"("sectionId", "articleCode");

-- CreateIndex
CREATE INDEX "NormativeParagraph_articleId_idx" ON "NormativeParagraph"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "NormativeParagraph_articleId_position_key" ON "NormativeParagraph"("articleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "NormativeParagraph_articleId_paragraphCode_key" ON "NormativeParagraph"("articleId", "paragraphCode");

-- CreateIndex
CREATE UNIQUE INDEX "NormativeClause_idrRef_key" ON "NormativeClause"("idrRef");

-- CreateIndex
CREATE UNIQUE INDEX "NormativeClause_currentVersionId_key" ON "NormativeClause"("currentVersionId");

-- CreateIndex
CREATE INDEX "NormativeClause_paragraphId_idx" ON "NormativeClause"("paragraphId");

-- CreateIndex
CREATE UNIQUE INDEX "NormativeClause_paragraphId_position_key" ON "NormativeClause"("paragraphId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "NormativeClause_paragraphId_clauseCode_key" ON "NormativeClause"("paragraphId", "clauseCode");

-- CreateIndex
CREATE INDEX "ClauseVersion_clauseId_idx" ON "ClauseVersion"("clauseId");

-- CreateIndex
CREATE INDEX "ClauseVersion_clauseId_isCurrent_idx" ON "ClauseVersion"("clauseId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "ClauseVersion_clauseId_version_key" ON "ClauseVersion"("clauseId", "version");

-- CreateIndex
CREATE INDEX "IdrRefRegistry_ownerKind_ownerId_idx" ON "IdrRefRegistry"("ownerKind", "ownerId");

-- CreateIndex
CREATE INDEX "IdrRefAlias_canonicalRef_idx" ON "IdrRefAlias"("canonicalRef");

-- CreateIndex
CREATE INDEX "InstrumentRevision_instrumentId_idx" ON "InstrumentRevision"("instrumentId");

-- CreateIndex
CREATE UNIQUE INDEX "InstrumentRevision_instrumentId_revisionNumber_key" ON "InstrumentRevision"("instrumentId", "revisionNumber");

-- CreateIndex
CREATE INDEX "InstrumentRevisionClauseVersion_clauseVersionId_idx" ON "InstrumentRevisionClauseVersion"("clauseVersionId");

-- CreateIndex
CREATE INDEX "Instrument_structuralProfile_idx" ON "Instrument"("structuralProfile");

-- AddForeignKey
ALTER TABLE "NormativeSection" ADD CONSTRAINT "NormativeSection_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormativeSection" ADD CONSTRAINT "NormativeSection_supersededBySectionId_fkey" FOREIGN KEY ("supersededBySectionId") REFERENCES "NormativeSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormativeArticle" ADD CONSTRAINT "NormativeArticle_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "NormativeSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormativeParagraph" ADD CONSTRAINT "NormativeParagraph_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NormativeArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormativeClause" ADD CONSTRAINT "NormativeClause_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "NormativeParagraph"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormativeClause" ADD CONSTRAINT "NormativeClause_supersededByClauseId_fkey" FOREIGN KEY ("supersededByClauseId") REFERENCES "NormativeClause"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NormativeClause" ADD CONSTRAINT "NormativeClause_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "ClauseVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClauseVersion" ADD CONSTRAINT "ClauseVersion_clauseId_fkey" FOREIGN KEY ("clauseId") REFERENCES "NormativeClause"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentRevision" ADD CONSTRAINT "InstrumentRevision_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentRevisionClauseVersion" ADD CONSTRAINT "InstrumentRevisionClauseVersion_instrumentRevisionId_fkey" FOREIGN KEY ("instrumentRevisionId") REFERENCES "InstrumentRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstrumentRevisionClauseVersion" ADD CONSTRAINT "InstrumentRevisionClauseVersion_clauseVersionId_fkey" FOREIGN KEY ("clauseVersionId") REFERENCES "ClauseVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Annex must reference parent instrument (ADR 0015)
ALTER TABLE "Instrument" ADD CONSTRAINT "Instrument_annex_requires_parent_check"
  CHECK ((NOT "isAnnex") OR ("parentInstrumentId" IS NOT NULL));
