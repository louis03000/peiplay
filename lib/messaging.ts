import { prisma } from '@/lib/prisma';
import { sendNotificationToEmail } from '@/lib/email';

// 通知類型
export type NotificationType = 
  | 'BOOKING_CREATED'
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REMINDER'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'PARTNER_APPLICATION'
  | 'SYSTEM_ANNOUNCEMENT';

// 發送預約相關通知（純 Email 通知）
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
): Promise<boolean> {
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

  // 直接發送 Email 通知
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      const emailSent = await sendNotificationToEmail(
        user.email,
        user.name || '用戶',
        {
          type,
          title,
          content,
          createdAt: new Date().toISOString(),
          data: bookingData,
        }
      );
      
      if (emailSent) {
        console.log(`✅ 預約通知 Email 已發送給用戶 ${user.email}: ${title}`);
        return true;
      } else {
        console.error(`❌ 發送預約通知 Email 失敗給用戶 ${user.email}`);
        return false;
      }
    } else {
      console.warn(`⚠️ 用戶 ${userId} 沒有 Email 地址，無法發送通知`);
      return false;
    }
  } catch (error) {
    console.error('❌ 發送預約通知 Email 失敗:', error);
    return false;
  }
}

// 發送系統廣播（純 Email 通知）
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
      select: { id: true, email: true, name: true },
    });

    const emailPromises = users
      .filter(user => user.email) // 只發送給有 Email 的用戶
      .map(user =>
        sendNotificationToEmail(
          user.email!,
          user.name || '用戶',
          {
            type: 'SYSTEM_ANNOUNCEMENT',
            title,
            content,
            createdAt: new Date().toISOString(),
          }
        )
      );

    await Promise.all(emailPromises);
    console.log(`✅ 系統廣播 Email 已發送給 ${emailPromises.length} 位用戶`);
    
    return emailPromises.length;
  } catch (error) {
    console.error('❌ 發送系統廣播失敗:', error);
    throw error;
  }
}

// 發送夥伴申請通知
export async function sendPartnerApplicationNotification(
  adminEmails: string[],
  partnerData: {
    name: string;
    email: string;
    phone: string;
    games: string[];
  }
) {
  try {
    const title = '新夥伴申請';
    const content = `有新的夥伴申請：${partnerData.name} (${partnerData.email})`;

    const emailPromises = adminEmails.map(adminEmail =>
      sendNotificationToEmail(
        adminEmail,
        '管理員',
        {
          type: 'PARTNER_APPLICATION',
          title,
          content,
          createdAt: new Date().toISOString(),
          data: partnerData,
        }
      )
    );

    await Promise.all(emailPromises);
    console.log(`✅ 夥伴申請通知 Email 已發送給 ${emailPromises.length} 位管理員`);
    
    return emailPromises.length;
  } catch (error) {
    console.error('❌ 發送夥伴申請通知失敗:', error);
    throw error;
  }
}