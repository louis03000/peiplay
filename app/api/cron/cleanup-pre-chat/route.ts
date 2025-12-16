import { NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';

/**
 * POST /api/cron/cleanup-pre-chat
 * 自動過期清理（每小時執行一次）
 * 
 * 刪除所有過期的預聊房間（expires_at < now()）
 * ON DELETE CASCADE 會自動清理相關訊息
 */
export async function POST(request: Request) {
  try {
    // 可選：驗證 cron secret（如果使用 Vercel Cron 或其他服務）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await db.query(async (client) => {
      // 刪除所有過期的房間
      const deleted = await (client as any).preChatRoom.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      return {
        deleted: deleted.count,
        timestamp: new Date().toISOString(),
      };
    }, 'cron:cleanup-pre-chat');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error cleaning up pre-chat rooms:', error);
    return NextResponse.json(
      { error: '清理失敗', details: (error as Error).message },
      { status: 500 }
    );
  }
}

