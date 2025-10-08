import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


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

    // 更新預約狀態
    const updatedBooking = await prisma.booking.update({
      where: {
        id: params.id
      },
      data: {
        status: status,
        ...(orderNumber && { orderNumber }),
        ...(paymentInfo && { paymentInfo }),
        ...(paymentError && { paymentError })
      },
      include: {
        schedule: {
          include: {
            partner: true
          }
        }
      }
    })

    // 如果預約完成，計算推薦收入
    if (status === 'COMPLETED') {
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