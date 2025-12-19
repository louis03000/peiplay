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
    const statusFilter = searchParams.get('status') || 'ALL'
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

      // 狀態篩選
      if (statusFilter !== 'ALL') {
        where.status = statusFilter;
      }

      // 日期篩選
      if (startDate || endDate) {
        where.schedule = {
          ...where.schedule,
          date: {},
        };
        if (startDate) {
          where.schedule.date.gte = new Date(startDate);
        }
        if (endDate) {
          const endDateObj = new Date(endDate);
          endDateObj.setHours(23, 59, 59, 999); // 設置為當天結束時間
          where.schedule.date.lte = endDateObj;
        }
      }

      // 查詢總數（用於分頁和統計）
      const totalCount = await client.booking.count({ where });

      // 查詢訂單列表
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
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
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
      const formattedBookings = bookings.map((booking) => {
        const duration = booking.schedule
          ? Math.round((new Date(booking.schedule.endTime).getTime() - new Date(booking.schedule.startTime).getTime()) / (1000 * 60 * 30)) // 以30分鐘為單位
          : 0;

        const paymentInfo = booking.paymentInfo as any;
        const isInstantBooking = paymentInfo?.isInstantBooking === true;

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
        };
      });

      const totalPages = Math.ceil(totalCount / limit);

      return {
        type: 'SUCCESS' as const,
        bookings: formattedBookings,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
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
