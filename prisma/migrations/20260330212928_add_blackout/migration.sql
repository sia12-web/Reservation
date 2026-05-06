-- CreateTable
CREATE TABLE "Blackout" (
    "id" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blackout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Blackout_startTime_endTime_idx" ON "Blackout"("startTime", "endTime");
