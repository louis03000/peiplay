import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chat/check-migration
 * 檢查聊天系統的 migration 狀態
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const result = await db.query(async (client) => {
      // 檢查表是否存在（使用原始 SQL）
      const tables = await (client as any).$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('ChatRoom', 'ChatRoomMember', 'ChatMessage', 'MessageReadReceipt')
        ORDER BY table_name;
      `;

      const tableNames = tables.map((t: any) => t.table_name);
      const expectedTables = [
        'ChatRoom',
        'ChatRoomMember',
        'ChatMessage',
        'MessageReadReceipt',
      ];

      const allTablesExist = expectedTables.every((name) =>
        tableNames.includes(name)
      );

      // 檢查是否有聊天室
      let roomCount = 0;
      if (allTablesExist) {
        try {
          const chatRoom = (client as any).chatRoom;
          if (chatRoom) {
            roomCount = await chatRoom.count();
          }
        } catch (error) {
          // 忽略錯誤
        }
      }

      return {
        migrationStatus: allTablesExist ? 'complete' : 'pending',
        tables: {
          ChatRoom: tableNames.includes('ChatRoom'),
          ChatRoomMember: tableNames.includes('ChatRoomMember'),
          ChatMessage: tableNames.includes('ChatMessage'),
          MessageReadReceipt: tableNames.includes('MessageReadReceipt'),
        },
        roomCount,
        message: allTablesExist
          ? 'Migration 已完成，聊天系統已啟用'
          : 'Migration 尚未完成，請執行資料庫 migration',
      };
    }, 'chat:check-migration:get');

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        migrationStatus: 'error',
        error: error.message || '檢查失敗',
      },
      { status: 500 }
    );
  }
}

