-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'STAFF', 'CLIENT');

-- CreateEnum
CREATE TYPE "TableType" AS ENUM ('STANDARD', 'MERGED_FIXED', 'CIRCULAR');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('HOLD', 'PENDING_DEPOSIT', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'REFUNDED', 'CORE_REFUNDED');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('WEB', 'KIOSK', 'PHONE');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCEEDED', 'PROCESSING', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "preferences" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Layout" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "adjacencyGraph" JSONB NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Layout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Table" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "type" "TableType" NOT NULL,
    "minCapacity" INTEGER NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    "priorityScore" INTEGER NOT NULL,
    "x" INTEGER NOT NULL DEFAULT 0,
    "y" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "shape" TEXT NOT NULL DEFAULT 'RECTANGLE',
    "rotation" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("id","layoutId")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT NOT NULL,
    "partySize" INTEGER NOT NULL,
    "startTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ NOT NULL,
    "status" "ReservationStatus" NOT NULL,
    "depositStatus" "DepositStatus" NOT NULL,
    "source" "ReservationSource" NOT NULL,
    "internalNotes" TEXT,
    "customerNotes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationTable" (
    "reservationId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ReservationTable_pkey" PRIMARY KEY ("reservationId","tableId","layoutId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerIntentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "Table_layoutId_idx" ON "Table"("layoutId");

-- CreateIndex
CREATE INDEX "Table_type_idx" ON "Table"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_shortId_key" ON "Reservation"("shortId");

-- CreateIndex
CREATE INDEX "Reservation_clientPhone_startTime_idx" ON "Reservation"("clientPhone", "startTime");

-- CreateIndex
CREATE INDEX "Reservation_startTime_endTime_idx" ON "Reservation"("startTime", "endTime");

-- CreateIndex
CREATE INDEX "ReservationTable_tableId_layoutId_idx" ON "ReservationTable"("tableId", "layoutId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerIntentId_key" ON "Payment"("providerIntentId");

-- CreateIndex
CREATE INDEX "Payment_reservationId_idx" ON "Payment"("reservationId");

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "Layout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationTable" ADD CONSTRAINT "ReservationTable_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationTable" ADD CONSTRAINT "ReservationTable_tableId_layoutId_fkey" FOREIGN KEY ("tableId", "layoutId") REFERENCES "Table"("id", "layoutId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationTable" ADD CONSTRAINT "ReservationTable_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "Layout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
