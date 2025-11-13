import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 測試資料庫連接...')
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已設定' : '未設定')
    
    // 測試基本連接和簡單查詢
    const userCount = await db.query(async (client) => {
      console.log('✅ 資料庫連接成功')
      const count = await client.user.count()
      console.log('✅ 用戶數量:', count)
      return count
    })
    
    return NextResponse.json({
      success: true,
      message: '資料庫連接正常',
      userCount,
      databaseUrl: process.env.DATABASE_URL ? '已設定' : '未設定'
    })
    
  } catch (error) {
    console.error('❌ 資料庫連接失敗:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      databaseUrl: process.env.DATABASE_URL ? '已設定' : '未設定',
      details: {
        message: '無法連接到資料庫',
        possibleCauses: [
          'DATABASE_URL 環境變數未設定',
          'Supabase 服務暫時不可用',
          '資料庫連接字串無效或過期',
          '網路連接問題'
        ]
      }
    }, { status: 500 })
  }
}