import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 獲取用戶設定
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    // 從資料庫獲取用戶設定，如果沒有則返回預設值
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        emailNotifications: true,
        messageNotifications: true,
        bookingNotifications: true,
        twoFactorEnabled: true,
        loginAlerts: true,
        securityAlerts: true,
      },
    });

    const settings = {
      emailNotifications: user?.emailNotifications ?? true,
      messageNotifications: user?.messageNotifications ?? true,
      bookingNotifications: user?.bookingNotifications ?? true,
      twoFactorEnabled: user?.twoFactorEnabled ?? false,
      loginAlerts: user?.loginAlerts ?? true,
      securityAlerts: user?.securityAlerts ?? true,
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error('獲取用戶設定失敗:', error);
    return NextResponse.json(
      { error: '獲取設定失敗' },
      { status: 500 }
    );
  }
}

// 更新用戶設定
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const body = await request.json();
    const {
      emailNotifications,
      messageNotifications,
      bookingNotifications,
      twoFactorEnabled,
      loginAlerts,
      securityAlerts,
    } = body;

    // 更新用戶設定
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        emailNotifications: emailNotifications ?? true,
        messageNotifications: messageNotifications ?? true,
        bookingNotifications: bookingNotifications ?? true,
        twoFactorEnabled: twoFactorEnabled ?? false,
        loginAlerts: loginAlerts ?? true,
        securityAlerts: securityAlerts ?? true,
      },
    });

    return NextResponse.json({ message: '設定已更新' });
  } catch (error) {
    console.error('更新用戶設定失敗:', error);
    return NextResponse.json(
      { error: '更新設定失敗' },
      { status: 500 }
    );
  }
}
