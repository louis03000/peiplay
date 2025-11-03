import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendBookingConfirmationEmail } from '@/lib/email'


export const dynamic = 'force-dynamic';
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { status, orderNumber, paymentInfo, paymentError } = body

    if (!status) {
      return NextResponse.json(
        { error: '缺少狀態參數' },
        { status: 400 }
      )
    }

    // 先獲取當前預約狀態
    const currentBooking = await prisma.booking.findUnique({
      where: { id: params.id },
      select: { status: true, isGroupBooking: true }
    })

    if (!currentBooking) {
      return NextResponse.json(
        { error: '預約不存在' },
        { status: 404 }
      )
    }

    // 狀態轉換驗證：付款成功後應該設置為等待夥伴確認，而不是直接確認
    let finalStatus = status
    if (orderNumber && (currentBooking.status === 'PENDING_PAYMENT' || currentBooking.status === 'PENDING')) {
      // 如果是群組預約，付款成功後直接確認；否則等待夥伴確認
      if (currentBooking.isGroupBooking) {
        finalStatus = 'CONFIRMED'
      } else {
        // 非群組預約，付款成功後應該等待夥伴確認
        finalStatus = 'PAID_WAITING_PARTNER_CONFIRMATION'
        console.log(`✅ 付款成功，預約 ${params.id} 狀態更新為 ${finalStatus}（等待夥伴確認）`)
      }
    } else if (status === 'CONFIRMED' && currentBooking.status === 'PENDING_PAYMENT') {
      // 防止直接從待付款跳轉到已確認（非群組預約）
      if (!currentBooking.isGroupBooking) {
        return NextResponse.json(
          { error: '非群組預約需要先等待夥伴確認，不能直接設置為已確認' },
          { status: 400 }
        )
      }
    }

    // 更新預約狀態
    const updatedBooking = await prisma.booking.update({
      where: {
        id: params.id
      },
      data: {
        status: finalStatus as any,
        ...(orderNumber && { orderNumber }),
        ...(paymentInfo && { paymentInfo }),
        ...(paymentError && { paymentError })
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
    })

    // 發送狀態更新通知
    if (finalStatus === 'CONFIRMED' && updatedBooking.customer.user.email) {
      try {
        const duration = Math.round((new Date(updatedBooking.schedule.endTime).getTime() - new Date(updatedBooking.schedule.startTime).getTime()) / (1000 * 60));
        
        await sendBookingConfirmationEmail(
          updatedBooking.customer.user.email,
          updatedBooking.customer.user.name || '客戶',
          updatedBooking.schedule.partner.user.name || '夥伴',
          {
            duration: duration,
            startTime: updatedBooking.schedule.startTime.toISOString(),
            endTime: updatedBooking.schedule.endTime.toISOString(),
            totalCost: updatedBooking.finalAmount || 0,
            bookingId: updatedBooking.id
          }
        );
        console.log('✅ 預約確認通知 email 已發送給顧客');
      } catch (emailError) {
        console.error('❌ 發送預約確認通知失敗:', emailError);
      }
    }

    // 如果預約完成，計算推薦收入
    if (finalStatus === 'COMPLETED') {
      try {
        const referralResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/partners/referral/calculate-earnings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ bookingId: params.id }),
        });
        
        if (referralResponse.ok) {
          const referralResult = await referralResponse.json();
          console.log(`✅ 預約 ${params.id} 推薦收入計算完成:`, referralResult);
        } else {
          console.log(`⚠️ 預約 ${params.id} 推薦收入計算失敗:`, referralResponse.status);
        }
      } catch (error) {
        console.error(`❌ 預約 ${params.id} 推薦收入計算錯誤:`, error);
      }
    }

    return NextResponse.json(updatedBooking)

  } catch (error) {
    console.error('Error updating booking status:', error)
    return NextResponse.json(
      { error: '更新預約狀態失敗' },
      { status: 500 }
    )
  }
} 