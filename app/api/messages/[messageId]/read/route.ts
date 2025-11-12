import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";

export const dynamic = 'force-dynamic';

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

    const result = await db.query(async (client) => {
      const message = await client.message.findUnique({
        where: { id: messageId },
        include: { receiver: true },
      });

      if (!message) {
        return { type: 'NOT_FOUND' } as const;
      }

      if (message.receiverId !== session.user.id) {
        return { type: 'FORBIDDEN' } as const;
      }

      const updatedMessage = await client.message.update({
        where: { id: messageId },
        data: { isRead: true },
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

      return { type: 'SUCCESS', message: updatedMessage } as const;
    }, 'messages:read');

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '訊息不存在' }, { status: 404 });
    }

    if (result.type === 'FORBIDDEN') {
      return NextResponse.json({ error: '無權限操作此訊息' }, { status: 403 });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    return createErrorResponse(error, 'messages:read');
  }
}
