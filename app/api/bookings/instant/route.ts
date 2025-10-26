import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  console.log('🚀 即時預約 API 開始處理...')
  
  // 先讀取請求數據
  let requestData;
  try {
    requestData = await request.json();
  } catch (e) {
    return NextResponse.json({ error: '無效的請求數據' }, { status: 400 });
  }
  
  try {
    // 檢查認證
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { partnerId, duration } = requestData
    console.log('📊 請求參數:', { partnerId, duration })

    if (!partnerId || !duration || duration <= 0) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    // 確保資料庫連線
    await prisma.$connect();

    // 查找客戶資料
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });

    if (!customer) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    // 查找夥伴資料
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 });
    }

    // 計算預約時間
    const now = new Date()
    const startTime = new Date(now.getTime() + 15 * 60 * 1000) // 15分鐘後開始
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000) // 加上預約時長

    // 計算費用
    const originalAmount = duration * partner.halfHourlyRate * 2
    const finalAmount = originalAmount

    // 先創建 Schedule 記錄
    const schedule = await prisma.schedule.create({
      data: {
        partnerId: partner.id,
        date: startTime,
        startTime: startTime,
        endTime: endTime,
        isAvailable: false
      }
    });

    // 創建即時預約記錄
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        scheduleId: schedule.id, // 使用創建的 schedule ID
        status: 'CONFIRMED',
        originalAmount: originalAmount,
        finalAmount: finalAmount,
        paymentInfo: {
          isInstantBooking: true
        }
      },
      include: {
        schedule: {
          include: {
            partner: {
              select: { name: true }
            }
          }
        }
      }
    });

    console.log("✅ 即時預約創建成功:", booking.id);

    // 返回成功回應
    return NextResponse.json({
      id: booking.id,
      message: '即時預約創建成功',
      totalCost: finalAmount,
      booking: {
        id: booking.id,
        status: booking.status,
        orderNumber: `INST-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        duration: duration,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        totalCost: finalAmount
      }
    })

  } catch (error) {
    console.error('❌ 即時預約創建失敗:', error)
    
    return NextResponse.json({
      error: '即時預約創建失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    // 確保斷開連線
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}