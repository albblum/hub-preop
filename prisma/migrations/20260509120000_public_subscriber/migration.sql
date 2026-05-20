-- Public mailing-list signups from the DocHub landing (cross-origin POST).
CREATE TABLE "PublicSubscriber" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PublicSubscriber_email_key" ON "PublicSubscriber"("email");
CREATE INDEX "PublicSubscriber_createdAt_idx" ON "PublicSubscriber"("createdAt");
