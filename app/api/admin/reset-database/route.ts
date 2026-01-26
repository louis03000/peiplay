import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";

export const dynamic = 'force-dynamic';

/**
 * 資料庫重置 API
 *
 * ⚠️ 警告：此功能會完全刪除所有用戶資料（除了管理員）
 * 僅管理員可執行
 */
export async function POST(request: Request) {
  try {
    // 驗證管理員權限
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const result = await db.query(async (client) => {
      // 檢查是否為管理員
      const admin = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!admin || admin.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const;
      }

      // 獲取所有管理員 ID（用於保護）
      const adminUsers = await client.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, email: true },
      });

      const adminIds = adminUsers.map(u => u.id);
      const adminEmails = adminUsers.map(u => u.email);

      console.log(`🛡️ 保護管理員帳號: ${adminEmails.join(', ')}`);

      // 在 transaction 中執行所有刪除操作
      await client.$transaction(async (tx) => {
        console.log('🗑️ 開始清除資料庫...');

        // ============================================
        // 按照外鍵依賴順序刪除（從子表到父表）
        // ============================================

        // 1. 刪除所有訊息相關資料
        console.log('1. 刪除訊息相關資料...');
        await tx.messageReadReceipt.deleteMany({});
        await tx.chatMessage.deleteMany({});
        await tx.message.deleteMany({});
        await tx.preChatMessage.deleteMany({});
        await tx.preChatRoom.deleteMany({});
        await tx.chatRoomMember.deleteMany({});
        await tx.chatRoom.deleteMany({});

        // 2. 刪除所有通知相關資料
        console.log('2. 刪除通知相關資料...');
        await tx.personalNotification.deleteMany({});
        await tx.adminMessage.deleteMany({});
        await tx.notification.deleteMany({});
        await tx.announcement.deleteMany({});

        // 3. 刪除所有審計和日誌
        console.log('3. 刪除審計和日誌...');
        await tx.logEntry.deleteMany({});
        await tx.securityLog.deleteMany({});
        await tx.passwordHistory.deleteMany({});

        // 4. 刪除所有評價相關資料
        console.log('4. 刪除評價相關資料...');
        await tx.groupBookingReview.deleteMany({});
        await tx.review.deleteMany({});

        // 5. 刪除所有推薦相關資料
        console.log('5. 刪除推薦相關資料...');
        await tx.referralEarning.deleteMany({});
        await tx.referralRecord.deleteMany({});

        // 6. 刪除所有支付和退款相關資料
        console.log('6. 刪除支付和退款相關資料...');
        await tx.payment.deleteMany({});
        await tx.refundRequest.deleteMany({});

        // 7. 刪除所有支援票證
        console.log('7. 刪除支援票證...');
        await tx.supportMessage.deleteMany({});
        await tx.supportTicket.deleteMany({});

        // 8. 刪除所有訂單和預約取消記錄
        console.log('8. 刪除訂單和預約取消記錄...');
        await tx.bookingCancellation.deleteMany({});
        await tx.order.deleteMany({});

        // 9. 刪除所有預約相關資料
        console.log('9. 刪除預約相關資料...');
        await tx.groupBookingParticipant.deleteMany({});
        await tx.multiPlayerBooking.deleteMany({});
        await tx.groupBooking.deleteMany({});
        await tx.booking.deleteMany({});

        // 10. 刪除所有時程表
        console.log('10. 刪除時程表...');
        await tx.schedule.deleteMany({});

        // 11. 刪除所有提領記錄（⚠️ 測試環境允許刪除）
        console.log('11. 刪除提領記錄...');
        await tx.withdrawalRequest.deleteMany({});

        // 12. 刪除所有夥伴相關資料
        console.log('12. 刪除夥伴相關資料...');
        await tx.rankingHistory.deleteMany({});
        await tx.promoCode.deleteMany({});
        await tx.partnerVerification.deleteMany({});
        await tx.favoritePartner.deleteMany({});
        await tx.partner.deleteMany({
          where: {
            userId: {
              notIn: adminIds, // 保護管理員的 partner 記錄
            },
          },
        });

        // 13. 刪除所有客戶相關資料
        console.log('13. 刪除客戶相關資料...');
        await tx.customer.deleteMany({
          where: {
            userId: {
              notIn: adminIds, // 保護管理員的 customer 記錄
            },
          },
        });

        // 14. 清除 KYC 和 PartnerVerification 的審核者引用（設置為 null，避免外鍵約束）
        console.log('14. 清除審核者引用...');
        await tx.kYC.updateMany({
          where: {
            reviewerId: {
              notIn: adminIds,
            },
          },
          data: { reviewerId: null },
        });
        
        await tx.partnerVerification.updateMany({
          where: {
            reviewerId: {
              notIn: adminIds,
            },
          },
          data: { reviewerId: null },
        });
        
        // 14.1. 刪除所有 KYC 記錄（非管理員）
        console.log('14.1. 刪除 KYC 記錄...');
        await tx.kYC.deleteMany({
          where: {
            userId: {
              notIn: adminIds,
            },
          },
        });
        
        await tx.partnerVerification.updateMany({
          where: {
            reviewerId: {
              notIn: adminIds,
            },
          },
          data: { reviewerId: null },
        });

        // 15. 最後刪除所有非管理員用戶
        console.log('15. 刪除非管理員用戶...');
        const deletedUsersCount = await tx.user.deleteMany({
          where: {
            role: {
              not: 'ADMIN',
            },
          },
        });

        console.log(`✅ 已刪除 ${deletedUsersCount.count} 個非管理員用戶`);

        // 16. 驗證管理員帳號仍然存在
        const remainingAdmins = await tx.user.findMany({
          where: { role: 'ADMIN' },
          select: { id: true, email: true },
        });

        if (remainingAdmins.length === 0) {
          throw new Error('❌ 錯誤：所有管理員帳號被刪除，這不應該發生！');
        }

        console.log(`✅ 保護的管理員帳號: ${remainingAdmins.map(a => a.email).join(', ')}`);

        return {
          deletedUsers: deletedUsersCount.count,
          protectedAdmins: remainingAdmins.map(a => a.email),
        };
      });

      return { type: 'SUCCESS' } as const;
    }, 'admin:reset-database');

    switch (result.type) {
      case 'NOT_ADMIN':
        return NextResponse.json({ error: '權限不足，僅管理員可執行此操作' }, { status: 403 });
      case 'SUCCESS':
        return NextResponse.json({ 
          message: '資料庫重置完成',
          warning: '所有非管理員用戶資料已完全清除'
        });
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ 資料庫重置失敗:', error);
    return createErrorResponse(error, 'admin:reset-database');
  }
}
