import { prisma } from '@/lib/prisma';
import { sendMessageToEmail, sendNotificationToEmail } from '@/lib/email';

// 訊息類型
export type MessageType = 'PRIVATE' | 'SYSTEM' | 'BOOKING' | 'ADMIN';

// 通知類型
export type NotificationType = 
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REMINDER'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PARTNER_APPLICATION'
  | 'SYSTEM_ANNOUNCEMENT'
  | 'MESSAGE_RECEIVED';

// 發送訊息
export async function sendMessage(data: {
  senderId: string;
  receiverId: string;
  subject: string;
  content: string;
  type?: MessageType;
  relatedId?: string;
  attachments?: string[];
}) {
  try {
    const message = await prisma.message.create({
      data: {
        senderId: data.senderId,
        receiverId: data.receiverId,
        subject: data.subject,
        content: data.content,
        type: data.type || 'PRIVATE',
        relatedId: data.relatedId,
        attachments: data.attachments || [],
      },
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

    // 創建通知
    const notification = await createNotification({
      userId: data.receiverId,
      type: 'MESSAGE_RECEIVED',
      title: '新訊息',
      content: `您收到來自 ${message.sender.name} 的新訊息：${data.subject}`,
      data: {
        messageId: message.id,
        senderId: data.senderId,
        senderName: message.sender.name,
      },
    });

    // 發送 Email 通知（如果用戶有 Email）
    if (message.receiver.email) {
      try {
        await sendMessageToEmail(
          message.receiver.email,
          message.receiver.name || '用戶',
          message.sender.name || '系統',
          {
            subject: data.subject,
            content: data.content,
            type: data.type || 'PRIVATE',
            createdAt: message.createdAt.toISOString(),
          }
        );
      } catch (emailError) {
        console.error('發送 Email 通知失敗:', emailError);
        // 不影響主要功能，繼續執行
      }
    }

    return message;
  } catch (error) {
    console.error('發送訊息失敗:', error);
    throw error;
  }
}

// 創建通知
export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  data?: any;
}) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        content: data.content,
        data: data.data,
      },
    });

    // 發送 Email 通知（如果用戶有 Email 且不是 MESSAGE_RECEIVED 類型）
    if (data.type !== 'MESSAGE_RECEIVED') {
      try {
        const user = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { email: true, name: true },
        });

        if (user?.email) {
          await sendNotificationToEmail(
            user.email,
            user.name || '用戶',
            {
              type: data.type,
              title: data.title,
              content: data.content,
              createdAt: notification.createdAt.toISOString(),
              data: data.data,
            }
          );
        }
      } catch (emailError) {
        console.error('發送通知 Email 失敗:', emailError);
        // 不影響主要功能，繼續執行
      }
    }

    return notification;
  } catch (error) {
    console.error('創建通知失敗:', error);
    throw error;
  }
}

// 發送預約相關通知
export async function sendBookingNotification(
  userId: string,
  type: NotificationType,
  bookingData: {
    bookingId: string;
    partnerName?: string;
    customerName?: string;
    startTime?: string;
    endTime?: string;
    amount?: number;
  }
) {
  let title = '';
  let content = '';

  switch (type) {
    case 'BOOKING_CREATED':
      title = '新預約通知';
      content = `您有一個新的預約請求，預約時間：${bookingData.startTime} - ${bookingData.endTime}`;
      break;
    case 'BOOKING_CONFIRMED':
      title = '預約確認';
      content = `您的預約已確認，預約時間：${bookingData.startTime} - ${bookingData.endTime}`;
      break;
    case 'BOOKING_CANCELLED':
      title = '預約取消';
      content = `您的預約已被取消，預約時間：${bookingData.startTime} - ${bookingData.endTime}`;
      break;
    case 'BOOKING_REMINDER':
      title = '預約提醒';
      content = `您的預約即將開始，預約時間：${bookingData.startTime} - ${bookingData.endTime}`;
      break;
    case 'PAYMENT_SUCCESS':
      title = '付款成功';
      content = `您的付款已成功處理，金額：NT$ ${bookingData.amount}`;
      break;
    case 'PAYMENT_FAILED':
      title = '付款失敗';
      content = `您的付款處理失敗，請重新嘗試`;
      break;
    default:
      title = '預約通知';
      content = '您有新的預約相關通知';
  }

  return await createNotification({
    userId,
    type,
    title,
    content,
    data: {
      ...bookingData,
    },
  });
}

// 發送系統廣播
export async function sendSystemBroadcast(
  title: string,
  content: string,
  userRoles?: string[]
) {
  try {
    const where: any = {};
    if (userRoles && userRoles.length > 0) {
      where.role = { in: userRoles };
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    });

    const notifications = await Promise.all(
      users.map(user =>
        createNotification({
          userId: user.id,
          type: 'SYSTEM_ANNOUNCEMENT',
          title,
          content,
        })
      )
    );

    return notifications;
  } catch (error) {
    console.error('發送系統廣播失敗:', error);
    throw error;
  }
}

// 獲取用戶未讀數量
export async function getUserUnreadCounts(userId: string) {
  try {
    const [messageCount, notificationCount] = await Promise.all([
      prisma.message.count({
        where: {
          receiverId: userId,
          isRead: false,
          isDeleted: false,
        },
      }),
      prisma.notification.count({
        where: {
          userId,
          isRead: false,
          isDeleted: false,
        },
      }),
    ]);

    return {
      messages: messageCount,
      notifications: notificationCount,
      total: messageCount + notificationCount,
    };
  } catch (error) {
    console.error('獲取未讀數量失敗:', error);
    return { messages: 0, notifications: 0, total: 0 };
  }
}

// 標記所有為已讀
export async function markAllAsRead(userId: string, type: 'messages' | 'notifications' | 'all') {
  try {
    if (type === 'messages' || type === 'all') {
      await prisma.message.updateMany({
        where: {
          receiverId: userId,
          isRead: false,
        },
        data: { isRead: true },
      });
    }

    if (type === 'notifications' || type === 'all') {
      await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: { isRead: true },
      });
    }

    return true;
  } catch (error) {
    console.error('標記已讀失敗:', error);
    throw error;
  }
}
