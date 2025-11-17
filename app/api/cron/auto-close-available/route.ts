import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 自動關閉「現在有空」開關的 API（手動調用）
 * 
 * ⚠️ 注意：此 API 不再通過 cron 自動執行
 * 自動關閉功能已整合到以下 API 中，會在用戶訪問時自動觸發：
 * - /api/partner/dashboard (GET) - 獲取夥伴儀表板時
 * - /api/partners/self (GET/PATCH) - 獲取或更新夥伴狀態時
 * 
 * 此 API 保留作為手動調用的備用方案，可用於：
 * - 管理員手動觸發批量關閉
 * - 測試和調試
 */
export async function GET(request: Request) {
  // 驗證 cron secret（如果設置了）
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    
    console.log(`🔄 開始檢查「現在有空」狀態，當前時間: ${new Date().toISOString()}`);
    
    const result = await db.query(async (client) => {
      // 找到所有開啟「現在有空」超過30分鐘的夥伴
      const expiredPartners = await client.partner.findMany({
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

      console.log(`📊 找到 ${expiredPartners.length} 個需要自動關閉的夥伴`);

      if (expiredPartners.length === 0) {
        return { 
          message: '沒有需要自動關閉的夥伴',
          closedCount: 0,
          timestamp: new Date().toISOString(),
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

      console.log(`✅ 自動關閉了 ${updateResult.count} 個夥伴的「現在有空」狀態`);

      return {
        message: `成功自動關閉 ${updateResult.count} 個夥伴的「現在有空」狀態`,
        closedCount: updateResult.count,
        timestamp: new Date().toISOString(),
        expiredPartners: expiredPartners.map(p => ({
          id: p.id,
          name: p.name,
          availableNowSince: p.availableNowSince
        }))
      }
    }, 'cron/auto-close-available')

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ 自動關閉「現在有空」狀態時發生錯誤:', error)
    return NextResponse.json(
      { 
        error: '自動關閉失敗', 
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

