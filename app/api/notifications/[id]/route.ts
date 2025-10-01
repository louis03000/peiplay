import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// 獲取單一通知詳情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: '通知不存在' },
        { status: 404 }
      );
    }

    // 檢查權限（只有通知的擁有者可以查看）
    if (notification.userId !== session.user.id) {
      return NextResponse.json(
        { error: '無權限查看此通知' },
        { status: 403 }
      );
    }

    // 標記為已讀
    if (!notification.isRead) {
      await prisma.notification.update({
        where: { id: params.id },
        data: { isRead: true },
      });
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error('獲取通知詳情失敗:', error);
    return NextResponse.json(
      { error: '獲取通知詳情失敗' },
      { status: 500 }
    );
  }
}

// 更新通知（標記已讀/刪除）
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const body = await request.json();
    const { isRead, isDeleted } = body;

    // 檢查通知是否存在且用戶有權限
    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: '通知不存在' },
        { status: 404 }
      );
    }

    // 檢查權限
    if (notification.userId !== session.user.id) {
      return NextResponse.json(
        { error: '無權限修改此通知' },
        { status: 403 }
      );
    }

    // 更新通知
    const updateData: any = {};
    if (typeof isRead === 'boolean') {
      updateData.isRead = isRead;
    }
    if (typeof isDeleted === 'boolean') {
      updateData.isDeleted = isDeleted;
    }

    const updatedNotification = await prisma.notification.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(updatedNotification);
  } catch (error) {
    console.error('更新通知失敗:', error);
    return NextResponse.json(
      { error: '更新通知失敗' },
      { status: 500 }
    );
  }
}

// 刪除通知
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    // 檢查通知是否存在且用戶有權限
    const notification = await prisma.notification.findUnique({
      where: { id: params.id },
    });

    if (!notification) {
      return NextResponse.json(
        { error: '通知不存在' },
        { status: 404 }
      );
    }

    // 檢查權限
    if (notification.userId !== session.user.id) {
      return NextResponse.json(
        { error: '無權限刪除此通知' },
        { status: 403 }
      );
    }

    // 軟刪除通知
    await prisma.notification.update({
      where: { id: params.id },
      data: { isDeleted: true },
    });

    return NextResponse.json({ message: '通知已刪除' });
  } catch (error) {
    console.error('刪除通知失敗:', error);
    return NextResponse.json(
      { error: '刪除通知失敗' },
      { status: 500 }
    );
  }
}
