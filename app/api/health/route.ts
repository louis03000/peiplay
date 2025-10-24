import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // 檢查環境變數
    const databaseUrl = process.env.DATABASE_URL
    const nextAuthSecret = process.env.NEXTAUTH_SECRET
    const nextAuthUrl = process.env.NEXTAUTH_URL

    // 測試資料庫連接
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: {
        databaseUrl: databaseUrl ? '✅ 已設定' : '❌ 未設定',
        nextAuthSecret: nextAuthSecret ? '✅ 已設定' : '❌ 未設定',
        nextAuthUrl: nextAuthUrl ? '✅ 已設定' : '❌ 未設定'
      },
      database: {
        connected: true,
        message: '資料庫連接正常'
      }
    })
  } catch (error) {
    console.error('Health check error:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      environment: {
        databaseUrl: process.env.DATABASE_URL ? '✅ 已設定' : '❌ 未設定',
        nextAuthSecret: process.env.NEXTAUTH_SECRET ? '✅ 已設定' : '❌ 未設定',
        nextAuthUrl: process.env.NEXTAUTH_URL ? '✅ 已設定' : '❌ 未設定'
      }
    }, { status: 500 })
  }
}
