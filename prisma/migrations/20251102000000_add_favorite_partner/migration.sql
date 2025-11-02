-- CreateTable
CREATE TABLE "FavoritePartner" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoritePartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FavoritePartner_customerId_partnerId_key" ON "FavoritePartner"("customerId", "partnerId");

-- CreateIndex
CREATE INDEX "FavoritePartner_customerId_idx" ON "FavoritePartner"("customerId");

-- CreateIndex
CREATE INDEX "FavoritePartner_partnerId_idx" ON "FavoritePartner"("partnerId");

-- AddForeignKey
ALTER TABLE "FavoritePartner" ADD CONSTRAINT "FavoritePartner_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoritePartner" ADD CONSTRAINT "FavoritePartner_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

