import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 獲取管理員私訊
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    await prisma.$connect();

    if (session.user.role === 'ADMIN') {
      // 管理員查看與特定用戶的對話
      if (!userId) {
        return NextResponse.json({ error: '缺少用戶ID' }, { status: 400 });
      }

      const messages = await prisma.adminMessage.findMany({
        where: {
          userId: userId
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          admin: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      return NextResponse.json({ messages });
    } else {
      // 用戶查看與管理員的對話
      const messages = await prisma.adminMessage.findMany({
        where: {
          userId: session.user.id
        },
        include: {
          admin: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      return NextResponse.json({ messages });
    }

  } catch (error) {
    console.error('❌ 獲取管理員私訊失敗:', error);
    return NextResponse.json({
      error: '獲取管理員私訊失敗',
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

// 發送管理員私訊
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, content, isFromAdmin = false } = body;

    if (!content) {
      return NextResponse.json({ error: '訊息內容不能為空' }, { status: 400 });
    }

    await prisma.$connect();

    let targetUserId = userId;
    let adminId = session.user.id;

    if (session.user.role === 'ADMIN') {
      // 管理員發送訊息
      if (!userId) {
        return NextResponse.json({ error: '缺少用戶ID' }, { status: 400 });
      }
      targetUserId = userId;
    } else {
      // 用戶回覆管理員
      targetUserId = session.user.id;
      // 需要找到管理員ID，這裡假設第一個管理員
      const admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        select: { id: true }
      });
      if (!admin) {
        return NextResponse.json({ error: '找不到管理員' }, { status: 404 });
      }
      adminId = admin.id;
    }

    const message = await prisma.adminMessage.create({
      data: {
        userId: targetUserId,
        adminId: adminId,
        content,
        isFromAdmin: session.user.role === 'ADMIN',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        admin: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    console.log(`✅ 已發送管理員私訊: ${content}`);
    return NextResponse.json({ 
      message,
      success: true
    });

  } catch (error) {
    console.error('❌ 發送管理員私訊失敗:', error);
    return NextResponse.json({
      error: '發送管理員私訊失敗',
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
