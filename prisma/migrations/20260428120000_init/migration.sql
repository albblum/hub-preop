-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "InstrumentStub" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "layer" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstrumentStub_pkey" PRIMARY KEY ("id")
);
