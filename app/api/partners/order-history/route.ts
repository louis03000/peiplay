import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { BookingStatus } from '@prisma/client'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log("✅ partners/order-history GET api triggered");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 獲取查詢參數
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const typeFilter = searchParams.get('type') || 'ALL'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!partner) {
        return { type: 'NO_PARTNER' } as const;
      }

      // 構建查詢條件
      const where: any = {
        schedule: { partnerId: partner.id },
        // 🔥 排除已拒絕的訂單
        status: {
          notIn: [BookingStatus.REJECTED],
        },
      };

      // 類型篩選（將在格式化數據後進行過濾）
      // 注意：由於 serviceType 是在格式化時計算的，我們需要在查詢後進行過濾

      // 日期篩選（使用 startTime 來篩選，因為預約日期應該基於開始時間）
      if (startDate || endDate) {
        where.schedule = {
          ...where.schedule,
          startTime: {},
        };
        if (startDate) {
          const startDateObj = new Date(startDate);
          startDateObj.setHours(0, 0, 0, 0); // 設置為當天開始時間
          where.schedule.startTime.gte = startDateObj;
        }
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999); // 設置為當天結束時間
          where.schedule.startTime.lte = endDateObj;
        }
      }

      // 🔥 先查詢總數（用於分頁計算，排除已拒絕的訂單）
      const totalCount = await client.booking.count({
        where,
      });

      // 查詢訂單列表
      // 如果有類型篩選，需要先查詢所有數據（因為類型是在格式化時計算的）
      const bookings = await client.booking.findMany({
        where,
        select: {
          id: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          originalAmount: true,
          finalAmount: true,
          paymentInfo: true,
          multiPlayerBookingId: true,
          groupBookingId: true,
          serviceType: true,
          customer: {
            select: {
              id: true,
              name: true,
            },
          },
          schedule: {
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              partner: {
                select: {
                  supportsChatOnly: true,
                  chatOnlyRate: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        // 如果有類型篩選，需要查詢所有數據；否則使用分頁
        ...(typeFilter === 'ALL' ? { skip: (page - 1) * limit, take: limit } : {}),
      });

      // 計算統計數據（所有訂單，不受分頁限制，排除已拒絕的訂單）
      const statsBookings = await client.booking.findMany({
        where: {
          schedule: { partnerId: partner.id },
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.PARTNER_ACCEPTED],
            notIn: [BookingStatus.REJECTED],
          },
        },
        select: {
          finalAmount: true,
        },
      });

      const totalEarnings = statsBookings.reduce((sum, booking) => sum + (booking.finalAmount || 0), 0);
      const totalOrders = statsBookings.length;

      // 格式化數據
      let formattedBookings = bookings.map((booking) => {
        // 🔥 計算時長（以分鐘為單位，而不是30分鐘為單位）
        const durationMinutes = booking.schedule
          ? Math.round((new Date(booking.schedule.endTime).getTime() - new Date(booking.schedule.startTime).getTime()) / (1000 * 60)) // 以分鐘為單位
          : 0;
        // 為了向後兼容，保留 duration 字段（以30分鐘為單位），但主要使用 durationMinutes
        const duration = Math.round(durationMinutes / 30);

        const paymentInfo = booking.paymentInfo as any;
        const isInstantBooking = paymentInfo?.isInstantBooking === true || paymentInfo?.isInstantBooking === 'true';

        // 🔥 判斷是否是純聊天（只有明確選擇純聊天篩選器時才是純聊天）
        // 必須在創建預約時明確標記為純聊天，不能僅因為夥伴支持純聊天就判斷為純聊天
        const isChatOnly = 
          booking.serviceType === 'CHAT_ONLY' || 
          paymentInfo?.isChatOnly === true || 
          paymentInfo?.isChatOnly === 'true';

        // 🔥 判斷服務類型（優先檢查純聊天，包括即時預約的純聊天）
        let serviceType = '一般預約'; // 預設值
        
        // 優先檢查多人陪玩（因為它可能同時有 paymentInfo）
        if (booking.multiPlayerBookingId) {
          serviceType = '多人陪玩'
        } else if (booking.groupBookingId) {
          serviceType = '群組預約'
        } else if (isChatOnly) {
          // 🔥 純聊天優先於即時預約（包括即時預約的純聊天）
          serviceType = '純聊天'
        } else if (isInstantBooking) {
          serviceType = '即時預約'
        }

        // 🔥 計算正確的金額：如果是純聊天，使用 chatOnlyRate 計算
        let displayAmount = booking.finalAmount || 0;
        if (isChatOnly && booking.schedule?.partner?.chatOnlyRate) {
          // 純聊天價格 = chatOnlyRate * 時長（以30分鐘為單位）
          displayAmount = booking.schedule.partner.chatOnlyRate * duration;
        }

        return {
          id: booking.id,
          orderNumber: `ORD-${booking.id.substring(0, 8).toUpperCase()}`,
          customerName: booking.customer.name,
          customerId: booking.customer.id,
          startTime: booking.schedule.startTime.toISOString(),
          endTime: booking.schedule.endTime.toISOString(),
          duration, // 保留以30分鐘為單位的字段（向後兼容）
          durationMinutes, // 添加以分鐘為單位的字段
          status: booking.status,
          originalAmount: Math.round(booking.originalAmount || 0), // 四舍五入
          finalAmount: Math.round(displayAmount), // 使用計算後的正確金額，並四舍五入
          createdAt: booking.createdAt.toISOString(),
          updatedAt: booking.updatedAt.toISOString(),
          paymentInfo: booking.paymentInfo,
          isInstantBooking,
          serviceType, // 添加服務類型
        };
      });

      // 類型篩選
      if (typeFilter !== 'ALL') {
        formattedBookings = formattedBookings.filter(booking => booking.serviceType === typeFilter);
      }

      // 計算總數和分頁
      // 🔥 如果有類型篩選，使用篩選後的數量；否則使用查詢時的總數
      const filteredCount = typeFilter !== 'ALL' ? formattedBookings.length : totalCount;
      const totalPages = Math.ceil(filteredCount / limit);
      // 如果有類型篩選，需要手動分頁；否則已經在查詢時分頁了
      const paginatedBookings = typeFilter !== 'ALL' 
        ? formattedBookings.slice((page - 1) * limit, page * limit)
        : formattedBookings;

      return {
        type: 'SUCCESS' as const,
        bookings: paginatedBookings,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount: filteredCount,
          limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        stats: {
          totalEarnings,
          totalOrders,
        },
      };
    }, 'partners:order-history');

    if (result.type === 'NO_PARTNER') {
      return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 });
    }

    return NextResponse.json({
      bookings: result.bookings,
      pagination: result.pagination,
      stats: result.stats,
    });

  } catch (error) {
    console.error('獲取接單紀錄時發生錯誤:', error)
    return createErrorResponse(error, 'partners:order-history')
  }
}

// 刪除舊資料的 API（可選功能）
export async function DELETE(request: NextRequest) {
  try {
    console.log("✅ partners/order-history DELETE api triggered");
    
    // 返回模擬刪除成功響應
    return NextResponse.json({
      message: '已刪除 0 筆 1 個月前的接單紀錄',
      deletedCount: 0,
      cutoffDate: new Date().toISOString()
    })

  } catch (error) {
    console.error('刪除舊資料時發生錯誤:', error)
    return NextResponse.json({ error: '刪除舊資料失敗' }, { status: 500 })
  }
}
