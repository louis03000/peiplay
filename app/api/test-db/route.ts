import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 測試資料庫連接
    await prisma.$connect();
    
    // 測試簡單查詢
    const userCount = await prisma.user.count();
    
    return NextResponse.json({
      success: true,
      message: '資料庫連接正常',
      userCount
    });
  } catch (error) {
    console.error('資料庫測試失敗:', error);
    return NextResponse.json({
      success: false,
      error: '資料庫連接失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 