import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("✅ bookings cancel POST api triggered");
    
    // 解析 params
    const resolvedParams = await params;
    
    // 檢查認證
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    
    const bookingId = resolvedParams.id;
    
    if (!bookingId) {
      return NextResponse.json({ error: '預約 ID 是必需的' }, { status: 400 });
    }

    // 查找客戶資料
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id }
    });

    if (!customer) {
      return NextResponse.json({ error: '客戶資料不存在' }, { status: 404 });
    }

    // 查找預約記錄，確認是該用戶的預約
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        schedule: true
      }
    });

    if (!booking) {
      return NextResponse.json({ error: '預約不存在' }, { status: 404 });
    }

    if (booking.customerId !== customer.id) {
      return NextResponse.json({ error: '沒有權限取消此預約' }, { status: 403 });
    }

    // 檢查預約是否已經被取消
    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ 
        success: true, 
        message: '預約已經被取消',
        booking 
      });
    }

    // 更新預約狀態為 CANCELLED
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED'
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

    console.log("✅ 預約取消成功:", updatedBooking.id);

    return NextResponse.json({ 
      success: true, 
      message: '預約已成功取消',
      booking: updatedBooking
    });

  } catch (error) {
    console.error('取消預約時發生錯誤:', error);
    console.error('錯誤詳情:', error);
    
    return NextResponse.json({ 
      error: '取消預約失敗，請稍後再試',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 