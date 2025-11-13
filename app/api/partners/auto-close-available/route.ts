import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'


export const dynamic = 'force-dynamic';
export async function POST() {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    
    const result = await db.query(async (client) => {
      // 找到所有開啟「現在有空」超過30分鐘的夥伴
      const expiredPartners = await client.partner.findMany({
        where: {
          isAvailableNow: true,
          availableNowSince: {
            lt: thirtyMinutesAgo
          }
        }
      })

      if (expiredPartners.length === 0) {
        return { 
          message: '沒有需要自動關閉的夥伴',
          closedCount: 0,
          expiredPartners: []
        }
      }

      // 批量關閉過期的「現在有空」狀態
      const updateResult = await client.partner.updateMany({
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

      console.log(`自動關閉了 ${updateResult.count} 個夥伴的「現在有空」狀態`)

      return {
        message: `成功自動關閉 ${updateResult.count} 個夥伴的「現在有空」狀態`,
        closedCount: updateResult.count,
        expiredPartners: expiredPartners.map(p => ({
          id: p.id,
          name: p.name,
          availableNowSince: p.availableNowSince
        }))
      }
    }, 'partners/auto-close-available')

    return NextResponse.json(result)

  } catch (error) {
    console.error('自動關閉「現在有空」狀態時發生錯誤:', error)
    return NextResponse.json(
      { error: '自動關閉失敗', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
