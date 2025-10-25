import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    console.log("✅ partners/order-history GET api triggered");
    
    // 獲取查詢參數
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    // 返回模擬訂單歷史數據
    const mockBookings = [
      {
        id: 'mock-order-1',
        orderNumber: 'ORD-20251026001',
        customerName: '測試客戶',
        customerId: 'mock-customer-1',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        duration: 4,
        status: 'CONFIRMED',
        originalAmount: 800,
        finalAmount: 800,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        paymentInfo: null,
        isInstantBooking: false
      }
    ];

    return NextResponse.json({
      bookings: mockBookings,
      pagination: {
        currentPage: page,
        totalPages: 1,
        totalCount: 1,
        limit,
        hasNextPage: false,
        hasPrevPage: false
      },
      stats: {
        totalEarnings: 800,
        totalOrders: 1
      }
    })

  } catch (error) {
    console.error('獲取接單紀錄時發生錯誤:', error)
    return NextResponse.json({ 
      error: '獲取接單紀錄失敗',
      bookings: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        limit: 10,
        hasNextPage: false,
        hasPrevPage: false
      },
      stats: {
        totalEarnings: 0,
        totalOrders: 0
      }
    }, { status: 500 })
  }
}

// 刪除舊資料的 API（可選功能）
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    })

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const months = parseInt(searchParams.get('months') || '1') // 預設刪除1個月前的資料

    const cutoffDate = new Date()
    cutoffDate.setMonth(cutoffDate.getMonth() - months)

    // 刪除舊的預約記錄（只刪除已完成的記錄）
    const deletedBookings = await prisma.booking.deleteMany({
      where: {
        schedule: {
          partnerId: partner.id
        },
        status: 'COMPLETED' as any,
        createdAt: {
          lt: cutoffDate
        }
      }
    })

    return NextResponse.json({
      message: `已刪除 ${deletedBookings.count} 筆 ${months} 個月前的接單紀錄`,
      deletedCount: deletedBookings.count,
      cutoffDate: cutoffDate.toISOString()
    })

  } catch (error) {
    console.error('刪除舊資料時發生錯誤:', error)
    return NextResponse.json({ error: '刪除舊資料失敗' }, { status: 500 })
  }
}
