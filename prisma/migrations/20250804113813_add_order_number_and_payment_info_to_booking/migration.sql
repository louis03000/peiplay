-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "orderNumber" TEXT,
ADD COLUMN     "paymentError" TEXT,
ADD COLUMN     "paymentInfo" JSONB,
ALTER COLUMN "finalAmount" DROP DEFAULT,
ALTER COLUMN "originalAmount" DROP DEFAULT;
