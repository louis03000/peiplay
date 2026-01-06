import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { Cache, CacheKeys, CacheTTL } from '@/lib/redis-cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 獲取所有活躍公告
export async function GET() {
  try {
    console.log('✅ announcements GET api triggered');

    const now = new Date();
    
    // 使用 Redis 快取（TTL: 2 分鐘，因為公告可能頻繁更新）
    const announcements = await Cache.getOrSet(
      CacheKeys.stats.platform() + ':announcements',
      async () => {
        return await db.query(async (client) => {
      // 優化策略：
      // 1. 使用 select 而不是 include，只查詢必要欄位
      // 2. 先查詢所有活躍公告，然後在應用層過濾過期（避免 OR 條件影響索引）
      // 3. 限制結果數量，避免載入過多資料
      // 4. 使用索引優化的排序
      
      // 先查詢所有活躍公告（使用 isActive 索引）
      const allAnnouncements = await client.announcement.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          expiresAt: true,
          createdAt: true,
          creator: {
            select: {
              name: true
            }
          }
        },
        // 使用 createdAt DESC 排序，利用索引
        orderBy: { createdAt: 'desc' },
        // 限制結果數量，避免載入過多資料
        take: 50,
      });

      // 在應用層過濾過期公告（避免 OR 條件影響索引使用）
      const validAnnouncements = allAnnouncements.filter(announcement => {
        if (!announcement.expiresAt) return true;
        return new Date(announcement.expiresAt) > now;
      });

          return validAnnouncements;
        }, 'announcements:get');
      },
      CacheTTL.SHORT // 2 分鐘快取
    );

    // 在應用層格式化資料，減少資料庫處理
    // 注意：從 Redis cache 返回的 createdAt 可能是字符串，需要處理
    const formattedAnnouncements = announcements.map(announcement => {
      // 處理 createdAt：如果是字符串則直接使用，如果是 Date 則轉換
      let createdAtStr: string;
      if (typeof announcement.createdAt === 'string') {
        createdAtStr = announcement.createdAt;
      } else if (announcement.createdAt instanceof Date) {
        createdAtStr = announcement.createdAt.toISOString();
      } else {
        // 如果都不是，嘗試轉換為 Date 再轉為 ISO 字符串
        createdAtStr = new Date(announcement.createdAt as any).toISOString();
      }

      // 處理 expiresAt：可能是字符串、Date 或 null
      let expiresAtStr: string | null = null;
      if (announcement.expiresAt) {
        if (typeof announcement.expiresAt === 'string') {
          expiresAtStr = announcement.expiresAt;
        } else if (announcement.expiresAt instanceof Date) {
          expiresAtStr = announcement.expiresAt.toISOString();
        } else {
          expiresAtStr = new Date(announcement.expiresAt as any).toISOString();
        }
      }

      return {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        type: announcement.type,
        createdAt: createdAtStr,
        expiresAt: expiresAtStr,
        creator: {
          name: announcement.creator.name
        }
      };
    });

    console.log(`📊 找到 ${formattedAnnouncements.length} 筆活躍公告`);
    
    // 設定 HTTP Cache Headers（Stale-While-Revalidate 策略）
    return NextResponse.json(
      { announcements: formattedAnnouncements },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );

  } catch (error) {
    console.error('❌ 獲取公告失敗:', error);
    
    // 如果資料庫錯誤，返回空公告列表而不是 500 錯誤
    console.log('🔄 返回空公告列表');
    return NextResponse.json({ 
      announcements: [],
      error: '暫時無法載入公告'
    });
  }
}

// 創建新公告（僅管理員）
export async function POST(request: Request) {
  try {
    console.log('✅ announcements POST api triggered');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 檢查是否為管理員
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '僅管理員可發布公告' }, { status: 403 });
    }

    const { title, content, type, expiresAt } = await request.json();

    if (!title || !content || !type) {
      return NextResponse.json({ error: '標題、內容和類型為必填' }, { status: 400 });
    }

    const announcement = await db.query(async (client) => {
      return await client.announcement.create({
        data: {
          title,
          content,
          type,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdBy: session.user.id
        }
      });
    });

    // 清除公告快取
    await Cache.delete(CacheKeys.stats.platform() + ':announcements');

    console.log(`✅ 公告創建成功: ${announcement.id}`);
    return NextResponse.json({
      success: true,
      announcement: {
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        type: announcement.type,
        createdAt: announcement.createdAt.toISOString(),
        expiresAt: announcement.expiresAt?.toISOString() || null
      }
    });

  } catch (error) {
    console.error('❌ 創建公告失敗:', error);
    return NextResponse.json({
      error: '創建公告失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
