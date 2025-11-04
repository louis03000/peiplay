import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendBookingNotificationEmail } from '@/lib/email'

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

    // 查找客戶資料
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id },
      include: {
        user: true
      }
    });

    if (!customer) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    // 查找夥伴資料
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: {
        user: true
      }
    });

    if (!partner) {
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 });
    }

    // 檢查夥伴是否正在執行訂單
    const { checkPartnerCurrentlyBusy, checkTimeConflict } = await import('@/lib/time-conflict');
    const busyCheck = await checkPartnerCurrentlyBusy(partner.id);
    
    if (busyCheck.isBusy) {
      return NextResponse.json({ 
        error: `夥伴目前正在服務中，預計 ${busyCheck.remainingMinutes} 分鐘後完成。請稍後再試。`,
        busyUntil: busyCheck.endTime,
        remainingMinutes: busyCheck.remainingMinutes
      }, { status: 409 });
    }

    // 計算預約時間
    const now = new Date()
    const startTime = new Date(now.getTime() + 15 * 60 * 1000) // 15分鐘後開始
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000) // 加上預約時長

    // 檢查時間衝突
    const conflictCheck = await checkTimeConflict(partner.id, startTime, endTime);
    
    if (conflictCheck.hasConflict) {
      const conflictTimes = conflictCheck.conflicts.map(c => 
        `${new Date(c.startTime).toLocaleString('zh-TW')} - ${new Date(c.endTime).toLocaleString('zh-TW')}`
      ).join(', ');
      
      return NextResponse.json({ 
        error: `時間衝突！該夥伴在以下時段已有預約：${conflictTimes}`,
        conflicts: conflictCheck.conflicts
      }, { status: 409 });
    }

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

    // 創建即時預約記錄 - 狀態設置為等待夥伴確認
    const booking = await prisma.booking.create({
      data: {
        customerId: customer.id,
        scheduleId: schedule.id, // 使用創建的 schedule ID
        status: 'PAID_WAITING_PARTNER_CONFIRMATION', // 等待夥伴確認，不是直接確認
        originalAmount: originalAmount,
        finalAmount: finalAmount,
        paymentInfo: {
          isInstantBooking: true
        }
      },
      include: {
        customer: {
          include: {
            user: true
          }
        },
        schedule: {
          include: {
            partner: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    console.log("✅ 即時預約創建成功:", booking.id, "狀態: PAID_WAITING_PARTNER_CONFIRMATION");

    // 發送 email 通知給夥伴（非阻塞方式，立即返回響應）
    sendBookingNotificationEmail(
      partner.user.email,
      partner.user.name || partner.name || '夥伴',
      customer.user.name || '客戶',
      {
        bookingId: booking.id,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: duration,
        totalCost: finalAmount,
        customerName: customer.user.name || '客戶',
        customerEmail: customer.user.email
      }
    ).then(() => {
      console.log(`✅ Email 通知已發送給夥伴: ${partner.user.email}`);
    }).catch((emailError) => {
      console.error('❌ Email 發送失敗:', emailError);
      // 不影響預約創建，只記錄錯誤
    });

    // 返回成功回應
    return NextResponse.json({
      id: booking.id,
      message: '預約創建成功，已通知夥伴確認',
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
  }
}