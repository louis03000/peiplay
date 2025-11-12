import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const email = session.user.email as string

    const { confirmationCode } = await request.json()
    const expectedCode = 'delect_account'

    if ((confirmationCode || '').trim() !== expectedCode) {
      return NextResponse.json({ error: '確認碼錯誤' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const user = await client.user.findUnique({
        where: { email },
        include: {
          customer: true,
          partner: true,
          reviewsGiven: true,
          reviewsReceived: true,
        },
      })

      if (!user) {
        return { type: 'NOT_FOUND' } as const
      }

      await client.$transaction(async (tx) => {
        await tx.review.deleteMany({
          where: {
            OR: [
              { reviewerId: user.id },
              { revieweeId: user.id },
            ],
          },
        })

        if (user.customer) {
          await tx.order.deleteMany({ where: { customerId: user.customer.id } })
          await tx.booking.deleteMany({ where: { customerId: user.customer.id } })
        }

        if (user.partner) {
          await tx.schedule.deleteMany({ where: { partnerId: user.partner.id } })
          await tx.partner.delete({ where: { id: user.partner.id } })
        }

        if (user.customer) {
          await tx.customer.delete({ where: { id: user.customer.id } })
        }

        await tx.user.delete({ where: { id: user.id } })
      })

      return { type: 'SUCCESS' } as const
    }, 'user:delete-account')

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: '帳號已成功註銷，所有資料已完全移除',
    })
  } catch (error) {
    return createErrorResponse(error, 'user:delete-account')
  }
} 