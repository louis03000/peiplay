import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { Cache, CacheKeys } from '@/lib/redis-cache';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 刪除公告（僅管理員）
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    console.log('✅ announcements DELETE api triggered');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 檢查是否為管理員
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '僅管理員可刪除公告' }, { status: 403 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ error: '公告 ID 為必填' }, { status: 400 });
    }

    // 檢查公告是否存在
    const existingAnnouncement = await db.query(async (client) => {
      return await client.announcement.findUnique({
        where: { id },
      });
    }, 'announcements:check-exists');

    if (!existingAnnouncement) {
      return NextResponse.json({ error: '公告不存在' }, { status: 404 });
    }

    // 刪除公告
    await db.query(async (client) => {
      return await client.announcement.delete({
        where: { id },
      });
    }, 'announcements:delete');

    // 清除公告快取
    await Cache.delete(CacheKeys.stats.platform() + ':announcements');

    console.log(`✅ 公告刪除成功: ${id}`);
    return NextResponse.json({
      success: true,
      message: '公告已刪除'
    });

  } catch (error) {
    console.error('❌ 刪除公告失敗:', error);
    return createErrorResponse(error, 'announcements:delete');
  }
}
