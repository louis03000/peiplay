/*
  Warnings:

  - You are about to drop the column `bankAccount` on the `Partner` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Partner" DROP COLUMN "bankAccount",
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankCode" TEXT;
