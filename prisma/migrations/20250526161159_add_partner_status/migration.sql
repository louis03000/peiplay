-- CreateEnum
CREATE TYPE "PartnerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "status" "PartnerStatus" NOT NULL DEFAULT 'PENDING';
