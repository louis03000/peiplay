import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 獲取所有活躍公告
export async function GET() {
  try {
    console.log('✅ announcements GET api triggered');
    
    await prisma.$connect();

    const now = new Date();
    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      },
      include: {
        creator: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedAnnouncements = announcements.map(announcement => ({
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      type: announcement.type,
      createdAt: announcement.createdAt.toISOString(),
      expiresAt: announcement.expiresAt?.toISOString() || null,
      creator: {
        name: announcement.creator.name
      }
    }));

    console.log(`📊 找到 ${formattedAnnouncements.length} 筆活躍公告`);
    return NextResponse.json({ announcements: formattedAnnouncements });

  } catch (error) {
    console.error('❌ 獲取公告失敗:', error);
    
    // 如果資料庫錯誤，返回空公告列表而不是 500 錯誤
    console.log('🔄 返回空公告列表');
    return NextResponse.json({ 
      announcements: [],
      error: '暫時無法載入公告'
    });
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
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

    await prisma.$connect();

    const announcement = await prisma.announcement.create({
      data: {
        title,
        content,
        type,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: session.user.id
      }
    });

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
  } finally {
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}
