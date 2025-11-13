import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log("🔍 開始簡單測試...")
    
    // 測試查詢
    const { userCount, firstUser } = await db.query(async (client) => {
      console.log("✅ Prisma 連線成功")
      
      const count = await client.user.count()
      console.log("✅ 用戶數量查詢成功:", count)
      
      const first = await client.user.findFirst({
        select: { id: true, email: true, role: true }
      })
      console.log("✅ 用戶查詢成功:", first)
      
      return { userCount: count, firstUser: first }
    })
    
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
