import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * 自動關閉「現在有空」開關的 Cron Job
 * 每天凌晨1點自動關閉開啟超過30分鐘的「現在有空」狀態
 * 
 * ⚠️ 注意：Vercel Hobby 計劃的 Cron Jobs 每天只能執行一次
 * 如果需要更頻繁的檢查，請升級到 Pro 計劃或使用其他方式實現
 * 
 * 在 Vercel 中，這個 endpoint 通過 vercel.json 配置 cron 任務
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

