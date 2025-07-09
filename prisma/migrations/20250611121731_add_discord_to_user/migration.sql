-- AlterTable
ALTER TABLE "User" ADD COLUMN     "discord" TEXT;

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'REJECTED';
