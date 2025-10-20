import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// 標記訊息為已讀
export async function PATCH(
  request: Request,
  { params }: { params: { messageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { messageId } = params;

    // 檢查訊息是否存在且用戶是接收者
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        receiver: true
      }
    });

    if (!message) {
      return NextResponse.json({ error: '訊息不存在' }, { status: 404 });
    }

    if (message.receiverId !== session.user.id) {
      return NextResponse.json({ error: '無權限操作此訊息' }, { status: 403 });
    }

    // 標記為已讀
    const updatedMessage = await prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        receiver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: updatedMessage
    });

  } catch (error) {
    console.error('標記訊息已讀失敗:', error);
    return NextResponse.json({ error: '標記訊息已讀失敗' }, { status: 500 });
  }
}
