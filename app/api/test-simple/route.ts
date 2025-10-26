import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log("🔍 開始簡單測試...")
    
    // 測試 1: 基本連線
    await prisma.$connect()
    console.log("✅ Prisma 連線成功")
    
    // 測試 2: 簡單查詢
    const userCount = await prisma.user.count()
    console.log("✅ 用戶數量查詢成功:", userCount)
    
    // 測試 3: 查詢第一個用戶
    const firstUser = await prisma.user.findFirst({
      select: { id: true, email: true, role: true }
    })
    console.log("✅ 用戶查詢成功:", firstUser)
    
    await prisma.$disconnect()
    
    return NextResponse.json({
      success: true,
      userCount,
      firstUser,
      message: '所有測試通過'
    })
    
  } catch (error) {
    console.error("❌ 測試失敗:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
