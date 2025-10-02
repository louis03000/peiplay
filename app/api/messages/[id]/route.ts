import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 獲取單一訊息詳情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const message = await prisma.message.findUnique({
      where: { id: params.id },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: '訊息不存在' },
        { status: 404 }
      );
    }

    // 檢查權限（只有發送者或接收者可以查看）
    if (message.senderId !== session.user.id && message.receiverId !== session.user.id) {
      return NextResponse.json(
        { error: '無權限查看此訊息' },
        { status: 403 }
      );
    }

    // 如果是接收者查看，標記為已讀
    if (message.receiverId === session.user.id && !message.isRead) {
      await prisma.message.update({
        where: { id: params.id },
        data: { isRead: true },
      });
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('獲取訊息詳情失敗:', error);
    return NextResponse.json(
      { error: '獲取訊息詳情失敗' },
      { status: 500 }
    );
  }
}

// 更新訊息（標記已讀/刪除）
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

    // 檢查訊息是否存在且用戶有權限
    const message = await prisma.message.findUnique({
      where: { id: params.id },
    });

    if (!message) {
      return NextResponse.json(
        { error: '訊息不存在' },
        { status: 404 }
      );
    }

    // 檢查權限
    if (message.senderId !== session.user.id && message.receiverId !== session.user.id) {
      return NextResponse.json(
        { error: '無權限修改此訊息' },
        { status: 403 }
      );
    }

    // 更新訊息
    const updateData: any = {};
    if (typeof isRead === 'boolean') {
      updateData.isRead = isRead;
    }
    if (typeof isDeleted === 'boolean') {
      updateData.isDeleted = isDeleted;
    }

    const updatedMessage = await prisma.message.update({
      where: { id: params.id },
      data: updateData,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.error('更新訊息失敗:', error);
    return NextResponse.json(
      { error: '更新訊息失敗' },
      { status: 500 }
    );
  }
}

// 刪除訊息
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    // 檢查訊息是否存在且用戶有權限
    const message = await prisma.message.findUnique({
      where: { id: params.id },
    });

    if (!message) {
      return NextResponse.json(
        { error: '訊息不存在' },
        { status: 404 }
      );
    }

    // 檢查權限
    if (message.senderId !== session.user.id && message.receiverId !== session.user.id) {
      return NextResponse.json(
        { error: '無權限刪除此訊息' },
        { status: 403 }
      );
    }

    // 軟刪除訊息
    await prisma.message.update({
      where: { id: params.id },
      data: { isDeleted: true },
    });

    return NextResponse.json({ message: '訊息已刪除' });
  } catch (error) {
    console.error('刪除訊息失敗:', error);
    return NextResponse.json(
      { error: '刪除訊息失敗' },
      { status: 500 }
    );
  }
}
