/*
  Warnings:

  - You are about to drop the column `hourlyRate` on the `Partner` table. All the data in the column will be lost.
  - Added the required column `halfHourlyRate` to the `Partner` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Partner" ADD COLUMN "halfHourlyRate" DOUBLE PRECISION;
UPDATE "Partner" SET "halfHourlyRate" = "hourlyRate";
ALTER TABLE "Partner" ALTER COLUMN "halfHourlyRate" SET NOT NULL;
ALTER TABLE "Partner" DROP COLUMN "hourlyRate";
