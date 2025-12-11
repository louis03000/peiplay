import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 臨時修復端點：添加 partnerId 欄位到 Booking 表
 * 警告：此端點應在修復完成後刪除
 */
export async function GET(request: Request) {
  // 簡單的認證檢查（可以添加更嚴格的認證）
  const authHeader = request.headers.get('authorization');
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  
  // 允許通過 query parameter 或 header 提供 secret
  const expectedSecret = process.env.FIX_DB_SECRET || 'temporary-fix-secret';
  if (authHeader !== `Bearer ${expectedSecret}` && secret !== expectedSecret) {
    return NextResponse.json({ 
      error: 'Unauthorized',
      hint: '請提供正確的 secret 參數或 authorization header'
    }, { status: 401 });
  }

  try {
    // 檢查欄位是否存在
    const checkColumn = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Booking' AND column_name = 'partnerId'
      ) AS exists;
    `;

    if (checkColumn[0]?.exists) {
      return NextResponse.json({
        success: true,
        message: 'partnerId 欄位已存在，無需修復',
      });
    }

    // 執行修復 SQL
    await prisma.$executeRaw`
      -- 添加欄位
      ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
    `;

    // 更新現有記錄
    await prisma.$executeRaw`
      UPDATE "Booking" b
      SET "partnerId" = s."partnerId"
      FROM "Schedule" s
      WHERE b."scheduleId" = s.id AND b."partnerId" IS NULL;
    `;

    // 設定為 NOT NULL
    await prisma.$executeRaw`
      ALTER TABLE "Booking" ALTER COLUMN "partnerId" SET NOT NULL;
    `;

    // 添加外鍵約束
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'Booking_partnerId_fkey'
        ) THEN
          ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerId_fkey" 
          FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `;

    // 添加索引
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Booking_partnerId_idx" ON "Booking"("partnerId");
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Booking_partnerId_createdAt_idx" ON "Booking"("partnerId", "createdAt" DESC);
    `;

    return NextResponse.json({
      success: true,
      message: 'partnerId 欄位已成功添加並更新所有記錄',
    });
  } catch (error: any) {
    console.error('修復失敗:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // 簡單的認證檢查（可以添加更嚴格的認證）
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.FIX_DB_SECRET || 'temporary-fix-secret'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 檢查欄位是否存在
    const checkColumn = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Booking' AND column_name = 'partnerId'
      ) AS exists;
    `;

    if (checkColumn[0]?.exists) {
      return NextResponse.json({
        success: true,
        message: 'partnerId 欄位已存在，無需修復',
      });
    }

    // 執行修復 SQL
    await prisma.$executeRaw`
      -- 添加欄位
      ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
    `;

    // 更新現有記錄
    await prisma.$executeRaw`
      UPDATE "Booking" b
      SET "partnerId" = s."partnerId"
      FROM "Schedule" s
      WHERE b."scheduleId" = s.id AND b."partnerId" IS NULL;
    `;

    // 設定為 NOT NULL
    await prisma.$executeRaw`
      ALTER TABLE "Booking" ALTER COLUMN "partnerId" SET NOT NULL;
    `;

    // 添加外鍵約束
    await prisma.$executeRaw`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'Booking_partnerId_fkey'
        ) THEN
          ALTER TABLE "Booking" ADD CONSTRAINT "Booking_partnerId_fkey" 
          FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
      END $$;
    `;

    // 添加索引
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Booking_partnerId_idx" ON "Booking"("partnerId");
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Booking_partnerId_createdAt_idx" ON "Booking"("partnerId", "createdAt" DESC);
    `;

    return NextResponse.json({
      success: true,
      message: 'partnerId 欄位已成功添加並更新所有記錄',
    });
  } catch (error: any) {
    console.error('修復失敗:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}

