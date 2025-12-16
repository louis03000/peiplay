import { NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';

/**
 * POST /api/internal/cleanup-pre-chat
 * 內部 API：自動過期清理（每小時執行一次）
 * 
 * 此路由專為 GitHub Actions 等外部 cron 服務設計
 * 需要 Authorization Bearer token 驗證
 * 
 * 刪除所有過期的預聊房間（expires_at < now()）
 * ON DELETE CASCADE 會自動清理相關訊息
 */
export async function POST(request: Request) {
  try {
    // 驗證 cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.warn('⚠️ CRON_SECRET 未設定，建議設定環境變數以確保安全');
    } else if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized', message: '無效的授權 token' },
        { status: 401 }
      );
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
        success: true,
        deleted: deleted.count,
        timestamp: new Date().toISOString(),
      };
    }, 'internal:cleanup-pre-chat');

    console.log(`✅ 清理完成：刪除了 ${result.deleted} 個過期的預聊房間`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ 清理預聊房間時發生錯誤:', error);
    return NextResponse.json(
      {
        success: false,
        error: '清理失敗',
        details: (error as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

