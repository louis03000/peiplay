import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendBookingNotificationEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Handles the creation of new bookings.
 */
export async function POST(request: Request) {
  try {
    console.log("✅ bookings POST api triggered");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { scheduleIds } = await request.json();

    if (!scheduleIds || !Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json({ error: 'Valid schedule IDs were not provided' }, { status: 400 });
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

    // 創建預約記錄
    const bookings = await Promise.all(
      scheduleIds.map(async (scheduleId: string) => {
        // 獲取 schedule 詳情
        const schedule = await prisma.schedule.findUnique({
          where: { id: scheduleId },
          include: {
            partner: {
              include: {
                user: true
              }
            }
          }
        });

        if (!schedule) {
          throw new Error(`Schedule ${scheduleId} not found`);
        }

        // 檢查時間衝突
        const { checkTimeConflict } = await import('@/lib/time-conflict');
        const conflictCheck = await checkTimeConflict(
          schedule.partnerId,
          schedule.startTime,
          schedule.endTime
        );
        
        if (conflictCheck.hasConflict) {
          const conflictTimes = conflictCheck.conflicts.map(c => 
            `${new Date(c.startTime).toLocaleString('zh-TW')} - ${new Date(c.endTime).toLocaleString('zh-TW')}`
          ).join(', ');
          
          throw new Error(`時間衝突！該夥伴在以下時段已有預約：${conflictTimes}`);
        }

        // 計算費用
        const duration = (schedule.endTime.getTime() - schedule.startTime.getTime()) / (1000 * 60 * 60);
        const originalAmount = duration * schedule.partner.halfHourlyRate * 2;
        const finalAmount = originalAmount;

        // 創建預約記錄
        const booking = await prisma.booking.create({
          data: {
            customerId: customer.id,
            scheduleId: scheduleId,
            status: 'PAID_WAITING_PARTNER_CONFIRMATION', // 等待夥伴確認
            originalAmount: originalAmount,
            finalAmount: finalAmount
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

        // 發送 email 通知給夥伴（非阻塞方式，立即返回響應）
        sendBookingNotificationEmail(
          schedule.partner.user.email,
          schedule.partner.user.name || '夥伴',
          customer.user.name || '客戶',
          {
            bookingId: booking.id,
            startTime: schedule.startTime.toISOString(),
            endTime: schedule.endTime.toISOString(),
            duration: duration,
            totalCost: finalAmount,
            customerName: customer.user.name || '客戶',
            customerEmail: customer.user.email
          }
        ).then(() => {
          console.log(`✅ Email 通知已發送給夥伴: ${schedule.partner.user.email}`);
        }).catch((emailError) => {
          console.error('❌ Email 發送失敗:', emailError);
          // 不影響預約創建，只記錄錯誤
        });

        return booking;
      })
    );

    return NextResponse.json({
      bookings: bookings.map(b => ({
        id: b.id,
        status: b.status,
        message: '預約創建成功，已通知夥伴'
      }))
    });

  } catch (error) {
    console.error('預約創建失敗:', error);
    return NextResponse.json({ 
      error: '預約創建失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Fetches bookings based on the user's role.
 */
export async function GET(request: NextRequest) {
  try {
    console.log("✅ bookings GET api triggered");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    // 查找客戶資料
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });

    if (!customer) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    // 查詢預約記錄
    const bookings = await prisma.booking.findMany({
      where: { customerId: customer.id },
      include: {
        schedule: {
          include: {
            partner: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ bookings });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json({
      error: '獲取預約記錄失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 