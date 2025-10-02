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

    return NextResponse.json(updatedBooking)

  } catch (error) {
    console.error('Error updating booking status:', error)
    return NextResponse.json(
      { error: '更新預約狀態失敗' },
      { status: 500 }
    )
  }
} 