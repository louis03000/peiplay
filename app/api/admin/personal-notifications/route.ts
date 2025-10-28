import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 獲取所有個人通知
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    await prisma.$connect();

    const notifications = await prisma.personalNotification.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        sender: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ notifications });

  } catch (error) {
    console.error('❌ 獲取個人通知失敗:', error);
    return NextResponse.json({
      error: '獲取個人通知失敗',
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

// 發送個人通知
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      userId, 
      title, 
      content, 
      type = 'INFO', 
      priority = 'MEDIUM',
      isImportant = false,
      expiresAt,
      sendEmail: shouldSendEmail = false
    } = body;

    if (!userId || !title || !content) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    await prisma.$connect();

    // 檢查用戶是否存在
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

    // 創建個人通知
    const notification = await prisma.personalNotification.create({
      data: {
        userId,
        senderId: session.user.id,
        title,
        content,
        type,
        priority,
        isImportant,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        sender: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    // 如果需要發送 Email
    if (shouldSendEmail && user.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: `[PeiPlay] ${title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #3B82F6;">PeiPlay 個人通知</h2>
              <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #1F2937; margin-top: 0;">${title}</h3>
                <p style="color: #374151; line-height: 1.6;">${content}</p>
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #D1D5DB;">
                  <p style="color: #6B7280; font-size: 14px;">
                    通知類型: ${type} | 優先級: ${priority}
                  </p>
                  ${expiresAt ? `<p style="color: #6B7280; font-size: 14px;">過期時間: ${new Date(expiresAt).toLocaleString('zh-TW')}</p>` : ''}
                </div>
              </div>
              <p style="color: #6B7280; font-size: 14px;">
                此為系統自動發送的通知，請勿回覆此郵件。
              </p>
            </div>
          `
        });
        console.log(`📧 已發送 Email 通知給 ${user.email}`);
      } catch (emailError) {
        console.error('❌ 發送 Email 失敗:', emailError);
        // Email 發送失敗不影響通知創建
      }
    }

    console.log(`✅ 已發送個人通知給用戶 ${user.name} (${user.email})`);
    return NextResponse.json({ 
      notification,
      message: '個人通知發送成功'
    });

  } catch (error) {
    console.error('❌ 發送個人通知失敗:', error);
    return NextResponse.json({
      error: '發送個人通知失敗',
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
