import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';

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

    const result = await db.query(async (client) => {
      if (session.user.role === 'ADMIN') {
        // 管理員查看與特定用戶的對話
        if (!userId) {
          throw new Error('缺少用戶ID');
        }

        const messages = await client.adminMessage.findMany({
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

        return { messages };
      } else {
        // 用戶查看與管理員的對話
        const messages = await client.adminMessage.findMany({
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

        return { messages };
      }
    }, 'admin-messages:GET');

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ 獲取管理員私訊失敗:', error);
    if (error instanceof NextResponse) {
      return error;
    }
    return NextResponse.json({
      error: '獲取管理員私訊失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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

    const result = await db.query(async (client) => {
      let targetUserId = userId;
      let adminId = session.user.id;

      if (session.user.role === 'ADMIN') {
        // 管理員發送訊息
        if (!userId) {
          throw new Error('缺少用戶ID');
        }
        targetUserId = userId;
      } else {
        // 用戶回覆管理員
        targetUserId = session.user.id;
        // 需要找到管理員ID，這裡假設第一個管理員
        const admin = await client.user.findFirst({
          where: { role: 'ADMIN' },
          select: { id: true }
        });
        if (!admin) {
          throw new Error('找不到管理員');
        }
        adminId = admin.id;
      }

      const message = await client.adminMessage.create({
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
      return { 
        message,
        success: true
      };
    }, 'admin-messages:POST');

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ 發送管理員私訊失敗:', error);
    if (error instanceof NextResponse) {
      return error;
    }
    return NextResponse.json({
      error: '發送管理員私訊失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
