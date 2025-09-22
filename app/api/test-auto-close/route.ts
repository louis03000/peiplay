import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    console.log('🧪 測試自動關閉「現在有空」功能...')
    
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    
    // 找到所有開啟「現在有空」超過30分鐘的夥伴
    const expiredPartners = await prisma.partner.findMany({
      where: {
        isAvailableNow: true,
        availableNowSince: {
          lt: thirtyMinutesAgo
        }
      },
      select: {
        id: true,
        name: true,
        availableNowSince: true
      }
    })

    if (expiredPartners.length === 0) {
      return NextResponse.json({ 
        message: '沒有需要自動關閉的夥伴',
        closedCount: 0,
        testTime: new Date().toISOString(),
        thirtyMinutesAgo: thirtyMinutesAgo.toISOString()
      })
    }

    // 批量關閉過期的「現在有空」狀態
    const result = await prisma.partner.updateMany({
      where: {
        isAvailableNow: true,
        availableNowSince: {
          lt: thirtyMinutesAgo
        }
      },
      data: {
        isAvailableNow: false,
        availableNowSince: null
      }
    })

    console.log(`✅ 測試：自動關閉了 ${result.count} 個夥伴的「現在有空」狀態`)

    return NextResponse.json({
      message: `測試成功：自動關閉了 ${result.count} 個夥伴的「現在有空」狀態`,
      closedCount: result.count,
      expiredPartners: expiredPartners,
      testTime: new Date().toISOString(),
      thirtyMinutesAgo: thirtyMinutesAgo.toISOString()
    })

  } catch (error) {
    console.error('測試自動關閉「現在有空」狀態時發生錯誤:', error)
    return NextResponse.json(
      { error: '測試失敗', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
