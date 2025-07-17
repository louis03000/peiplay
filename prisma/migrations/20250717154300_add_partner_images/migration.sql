-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "rejectReason" TEXT;

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];
