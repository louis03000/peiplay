/**
 * 資料庫重置腳本（一次性，僅用於測試環境）
 * 
 * ⚠️ 警告：此腳本會完全刪除所有用戶資料（除了管理員）
 * 只能在非 production 環境執行
 * 
 * 使用方法：
 *   node scripts/reset-database.js
 */

const { PrismaClient } = require('@prisma/client');

// 嚴格檢查環境
if (process.env.NODE_ENV === 'production') {
  console.error('❌ 錯誤：此腳本不允許在 production 環境執行！');
  console.error('   請設置 NODE_ENV=development 或 NODE_ENV=test');
  process.exit(1);
}

const prisma = new PrismaClient();

async function resetDatabase() {
  try {
    console.log('🚀 開始資料庫重置...\n');

    // 獲取所有管理員 ID（用於保護）
    const adminUsers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true, email: true },
    });

    if (adminUsers.length === 0) {
      console.error('❌ 錯誤：資料庫中沒有管理員帳號，無法執行重置！');
      process.exit(1);
    }

    const adminIds = adminUsers.map(u => u.id);
    const adminEmails = adminUsers.map(u => u.email);

    console.log(`🛡️ 保護管理員帳號: ${adminEmails.join(', ')}\n`);

    // 在 transaction 中執行所有刪除操作
    await prisma.$transaction(async (tx) => {
      console.log('🗑️ 開始清除資料庫...\n');

      // ============================================
      // 按照外鍵依賴順序刪除（從子表到父表）
      // ============================================

      console.log('1. 刪除訊息相關資料...');
      await tx.messageReadReceipt.deleteMany({});
      await tx.chatMessage.deleteMany({});
      await tx.message.deleteMany({});
      await tx.preChatMessage.deleteMany({});
      await tx.preChatRoom.deleteMany({});
      await tx.chatRoomMember.deleteMany({});
      await tx.chatRoom.deleteMany({});

      console.log('2. 刪除通知相關資料...');
      await tx.personalNotification.deleteMany({});
      await tx.adminMessage.deleteMany({});
      await tx.notification.deleteMany({});
      await tx.announcement.deleteMany({});

      console.log('3. 刪除審計和日誌...');
      await tx.logEntry.deleteMany({});
      await tx.securityLog.deleteMany({});
      await tx.passwordHistory.deleteMany({});

      console.log('4. 刪除評價相關資料...');
      await tx.groupBookingReview.deleteMany({});
      await tx.review.deleteMany({});

      console.log('5. 刪除推薦相關資料...');
      await tx.referralEarning.deleteMany({});
      await tx.referralRecord.deleteMany({});

      console.log('6. 刪除支付和退款相關資料...');
      await tx.payment.deleteMany({});
      await tx.refundRequest.deleteMany({});

      console.log('7. 刪除支援票證...');
      await tx.supportMessage.deleteMany({});
      await tx.supportTicket.deleteMany({});

      console.log('8. 刪除訂單和預約取消記錄...');
      await tx.bookingCancellation.deleteMany({});
      await tx.order.deleteMany({});

      console.log('9. 刪除預約相關資料...');
      await tx.groupBookingParticipant.deleteMany({});
      await tx.multiPlayerBooking.deleteMany({});
      await tx.groupBooking.deleteMany({});
      await tx.booking.deleteMany({});

      console.log('10. 刪除時程表...');
      await tx.schedule.deleteMany({});

      console.log('11. 刪除提領記錄...');
      await tx.withdrawalRequest.deleteMany({});

      console.log('12. 清除審核者引用...');
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

      console.log('13. 刪除 KYC 記錄...');
      await tx.kYC.deleteMany({
        where: {
          userId: {
            notIn: adminIds,
          },
        },
      });

      console.log('14. 刪除夥伴相關資料...');
      await tx.rankingHistory.deleteMany({});
      await tx.promoCode.deleteMany({});
      await tx.partnerVerification.deleteMany({});
      await tx.favoritePartner.deleteMany({});
      await tx.partner.deleteMany({
        where: {
          userId: {
            notIn: adminIds,
          },
        },
      });

      console.log('15. 刪除客戶相關資料...');
      await tx.customer.deleteMany({
        where: {
          userId: {
            notIn: adminIds,
          },
        },
      });

      console.log('16. 刪除非管理員用戶...');
      const deletedUsersResult = await tx.user.deleteMany({
        where: {
          role: {
            not: 'ADMIN',
          },
        },
      });

      console.log(`✅ 已刪除 ${deletedUsersResult.count} 個非管理員用戶\n`);

      // 驗證管理員帳號仍然存在
      const remainingAdmins = await tx.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true, email: true },
      });

      if (remainingAdmins.length === 0) {
        throw new Error('❌ 錯誤：所有管理員帳號被刪除，這不應該發生！');
      }

      console.log(`✅ 保護的管理員帳號: ${remainingAdmins.map(a => a.email).join(', ')}\n`);
    });

    console.log('✅ 資料庫重置完成！\n');
    console.log('📊 統計：');
    console.log(`   - 保護的管理員數量: ${adminUsers.length}`);
    console.log(`   - 所有非管理員資料已清除\n`);

  } catch (error) {
    console.error('❌ 資料庫重置失敗:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 執行重置
resetDatabase()
  .then(() => {
    console.log('✅ 腳本執行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 腳本執行失敗:', error);
    process.exit(1);
  });
