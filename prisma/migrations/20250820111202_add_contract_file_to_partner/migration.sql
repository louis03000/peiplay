-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'COMPLETED_WITH_AMOUNT_MISMATCH';

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "contractFile" TEXT;
