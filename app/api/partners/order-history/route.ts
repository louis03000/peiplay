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

      // 計算統計數據（所有訂單，不受分頁限制）
      const statsBookings = await client.booking.findMany({
        where: {
          schedule: { partnerId: partner.id },
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED, BookingStatus.PARTNER_ACCEPTED],
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
        const duration = booking.schedule
          ? Math.round((new Date(booking.schedule.endTime).getTime() - new Date(booking.schedule.startTime).getTime()) / (1000 * 60 * 30)) // 以30分鐘為單位
          : 0;

        const paymentInfo = booking.paymentInfo as any;
        const isInstantBooking = paymentInfo?.isInstantBooking === true || paymentInfo?.isInstantBooking === 'true';

        // 🔥 判斷服務類型（與 admin/order-records 邏輯一致）
        let serviceType = '一般預約'; // 預設值
        
        // 優先檢查多人陪玩（因為它可能同時有 paymentInfo）
        if (booking.multiPlayerBookingId) {
          serviceType = '多人陪玩'
        } else if (isInstantBooking) {
          serviceType = '即時預約'
        } else if (booking.groupBookingId) {
          serviceType = '群組預約'
        } else if (
          booking.serviceType === 'CHAT_ONLY' || 
          paymentInfo?.isChatOnly === true || 
          paymentInfo?.isChatOnly === 'true' ||
          (booking.schedule?.partner?.supportsChatOnly && booking.schedule?.partner?.chatOnlyRate)
        ) {
          serviceType = '純聊天'
        }

        return {
          id: booking.id,
          orderNumber: `ORD-${booking.id.substring(0, 8).toUpperCase()}`,
          customerName: booking.customer.name,
          customerId: booking.customer.id,
          startTime: booking.schedule.startTime.toISOString(),
          endTime: booking.schedule.endTime.toISOString(),
          duration,
          status: booking.status,
          originalAmount: booking.originalAmount || 0,
          finalAmount: booking.finalAmount || 0,
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
      const filteredCount = formattedBookings.length;
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
