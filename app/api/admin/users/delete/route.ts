import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db-resilience";
import { createErrorResponse } from "@/lib/api-helpers";

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: '缺少用戶ID' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      const admin = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      });

      if (!admin || admin.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const;
      }

      if (userId === session.user.id) {
        return { type: 'SELF_DELETE' } as const;
      }

      const user = await client.user.findUnique({
        where: { id: userId },
        include: {
          partner: true,
          customer: true,
        },
      });

      if (!user) {
        return { type: 'NOT_FOUND' } as const;
      }

      await client.$transaction(async (tx) => {
        if (user.partner) {
          // 先刪除 Partner 相關的所有關聯資料
          const partnerId = user.partner.id;
          
          // 1. 刪除 Schedule（已有）
          await tx.schedule.deleteMany({ where: { partnerId } });
          
          // 2. 刪除 ReferralRecord（推薦記錄）
          // 先刪除 ReferralEarning（因為它依賴 ReferralRecord）
          const referralRecords = await tx.referralRecord.findMany({
            where: {
              OR: [
                { inviterId: partnerId },
                { inviteeId: partnerId },
              ],
            },
            select: { id: true },
          });
          
          for (const record of referralRecords) {
            await tx.referralEarning.deleteMany({ 
              where: { referralRecordId: record.id } 
            });
          }
          
          await tx.referralRecord.deleteMany({
            where: {
              OR: [
                { inviterId: partnerId },
                { inviteeId: partnerId },
              ],
            },
          });
          
          // 3. 刪除 PromoCode
          await tx.promoCode.deleteMany({ where: { partnerId } });
          
          // 4. 刪除 RankingHistory
          await tx.rankingHistory.deleteMany({ where: { partnerId } });
          
          // 5. 刪除 GroupBookingParticipant（作為 partner）
          await tx.groupBookingParticipant.deleteMany({ 
            where: { partnerId } 
          });
          
          // 6. 刪除 FavoritePartner（作為被收藏的 partner）
          await tx.favoritePartner.deleteMany({ where: { partnerId } });
          
          // 7. 刪除 PartnerVerification
          await tx.partnerVerification.deleteMany({ 
            where: { partnerId } 
          });
          
          // 8. 刪除 Booking（透過 partnerId）
          const partnerBookings = await tx.booking.findMany({
            where: { partnerId },
            select: { id: true },
          });
          
          for (const booking of partnerBookings) {
            // 刪除 Booking 相關的 ChatRoom（如果存在）
            await tx.chatRoom.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 ReferralEarning
            await tx.referralEarning.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 Payment
            await tx.payment.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 RefundRequest
            await tx.refundRequest.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 SupportTicket
            await tx.supportTicket.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 BookingCancellation
            await tx.bookingCancellation.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 Review
            await tx.review.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 Order
            await tx.order.deleteMany({ 
              where: { bookingId: booking.id } 
            });
          }
          
          await tx.booking.deleteMany({ where: { partnerId } });
          
          // 9. 檢查是否有提領記錄（提領記錄永久保存，不允許刪除）
          const withdrawalCount = await tx.withdrawalRequest.count({
            where: { partnerId },
          });
          
          if (withdrawalCount > 0) {
            // 如果有提領記錄，不允許刪除 Partner（提領記錄需要永久保存）
            // 可以選擇：1. 阻止刪除 2. 只標記 Partner 為已刪除但不真正刪除
            // 這裡選擇阻止刪除，確保提領記錄的完整性
            throw new Error(`無法刪除夥伴：該夥伴有 ${withdrawalCount} 筆提領記錄，提領記錄需要永久保存`);
          }
          
          // 10. 最後刪除 Partner
          await tx.partner.delete({ where: { id: partnerId } });
        }

        if (user.customer) {
          // 先刪除 Customer 相關的所有關聯資料
          const customerId = user.customer.id;
          
          // 1. 刪除 GroupBookingParticipant（作為 customer）
          await tx.groupBookingParticipant.deleteMany({ 
            where: { customerId } 
          });
          
          // 2. 刪除 GroupBookingReview
          await tx.groupBookingReview.deleteMany({ 
            where: { reviewerId: customerId } 
          });
          
          // 3. 刪除 MultiPlayerBooking
          await tx.multiPlayerBooking.deleteMany({ 
            where: { customerId } 
          });
          
          // 4. 刪除 FavoritePartner（作為收藏者）
          await tx.favoritePartner.deleteMany({ 
            where: { customerId } 
          });
          
          // 5. 刪除 MultiPlayerBooking 相關的 ChatRoom
          const multiPlayerBookings = await tx.multiPlayerBooking.findMany({
            where: { customerId },
            select: { id: true },
          });
          
          for (const mpBooking of multiPlayerBookings) {
            await tx.chatRoom.deleteMany({ 
              where: { multiPlayerBookingId: mpBooking.id } 
            });
          }
          
          // 6. 刪除 Booking（透過 customerId）
          const customerBookings = await tx.booking.findMany({
            where: { customerId },
            select: { id: true },
          });
          
          for (const booking of customerBookings) {
            // 刪除 Booking 相關的 ChatRoom（如果存在）
            await tx.chatRoom.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 ReferralEarning
            await tx.referralEarning.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 Payment
            await tx.payment.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 RefundRequest
            await tx.refundRequest.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 SupportTicket
            await tx.supportTicket.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 BookingCancellation
            await tx.bookingCancellation.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 Review
            await tx.review.deleteMany({ 
              where: { bookingId: booking.id } 
            });
            // 刪除 Booking 相關的 Order
            await tx.order.deleteMany({ 
              where: { bookingId: booking.id } 
            });
          }
          
          await tx.booking.deleteMany({ where: { customerId } });
          
          // 7. 刪除 Order（透過 customerId）
          await tx.order.deleteMany({ where: { customerId } });
          
          // 8. 刪除 BookingCancellation（透過 customerId）
          await tx.bookingCancellation.deleteMany({ 
            where: { customerId } 
          });
          
          // 9. 最後刪除 Customer
          await tx.customer.delete({ where: { id: customerId } });
        }

        // 刪除 User 相關的 Review（作為 reviewer 或 reviewee）
        await tx.review.deleteMany({
          where: {
            OR: [
              { reviewerId: userId },
              { revieweeId: userId },
            ],
          },
        });

        // 最後刪除 User
        await tx.user.delete({ where: { id: userId } });
      });

      return { type: 'SUCCESS' } as const;
    }, 'admin:users:delete');

    switch (result.type) {
      case 'NOT_ADMIN':
        return NextResponse.json({ error: '權限不足' }, { status: 403 });
      case 'SELF_DELETE':
        return NextResponse.json({ error: '不能刪除自己的帳號' }, { status: 400 });
      case 'NOT_FOUND':
        return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
      case 'SUCCESS':
        return NextResponse.json({ message: '用戶已成功刪除' });
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 });
    }
  } catch (error) {
    return createErrorResponse(error, 'admin:users:delete');
  }
} 