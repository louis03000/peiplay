import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 診斷端點：測試資料庫連接和基本操作
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const results: any = {
      timestamp: new Date().toISOString(),
      tests: [],
    }

    // 測試 1: 基本連接
    try {
      const start = Date.now()
      await prisma.$queryRaw`SELECT 1`
      const duration = Date.now() - start
      results.tests.push({
        name: '基本連接測試',
        status: 'success',
        duration: `${duration}ms`,
      })
    } catch (error) {
      results.tests.push({
        name: '基本連接測試',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // 測試 2: 查詢客戶
    try {
      const start = Date.now()
      const customer = await prisma.customer.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      })
      const duration = Date.now() - start
      results.tests.push({
        name: '查詢客戶資料',
        status: customer ? 'success' : 'not_found',
        duration: `${duration}ms`,
        found: !!customer,
      })
    } catch (error) {
      results.tests.push({
        name: '查詢客戶資料',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // 測試 3: 查詢夥伴
    try {
      const start = Date.now()
      const partners = await prisma.partner.findMany({
        take: 1,
        select: { id: true },
      })
      const duration = Date.now() - start
      results.tests.push({
        name: '查詢夥伴資料',
        status: 'success',
        duration: `${duration}ms`,
        found: partners.length > 0,
      })
    } catch (error) {
      results.tests.push({
        name: '查詢夥伴資料',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // 測試 4: 事務測試
    try {
      const start = Date.now()
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1`
      })
      const duration = Date.now() - start
      results.tests.push({
        name: '事務測試',
        status: 'success',
        duration: `${duration}ms`,
      })
    } catch (error) {
      results.tests.push({
        name: '事務測試',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // 測試 5: db.query 包裝器
    try {
      const start = Date.now()
      await db.query(async (client) => {
        await client.customer.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        })
      }, 'test')
      const duration = Date.now() - start
      results.tests.push({
        name: 'db.query 包裝器測試',
        status: 'success',
        duration: `${duration}ms`,
      })
    } catch (error) {
      results.tests.push({
        name: 'db.query 包裝器測試',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // 檢查資料庫健康狀態
    try {
      const health = await db.healthCheck()
      results.health = health
    } catch (error) {
      results.health = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    return NextResponse.json(
      {
        error: '診斷失敗',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

