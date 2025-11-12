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

    const { confirmationCode } = await request.json()
    const expectedCode = 'delect_account'

    if ((confirmationCode || '').trim() !== expectedCode) {
      return NextResponse.json({ error: '確認碼錯誤' }, { status: 400 })
    }

    const email = session.user.email as string

    const result = await db.query(async (client) => {
      const user = await client.user.findUnique({ where: { email } })
      if (!user) {
        return { type: 'NOT_FOUND' } as const
      }

      await client.$transaction(async (tx) => {
        await tx.booking.deleteMany({ where: { customer: { userId: user.id } } })
        await tx.order.deleteMany({ where: { customer: { userId: user.id } } })
        await tx.customer.deleteMany({ where: { userId: user.id } })

        const partner = await tx.partner.findUnique({ where: { userId: user.id } })
        if (partner) {
          await tx.schedule.deleteMany({ where: { partnerId: partner.id } })
          await tx.partner.deleteMany({ where: { userId: user.id } })
        }

        await tx.user.delete({ where: { id: user.id } })
      })

      return { type: 'SUCCESS' } as const
    }, 'user:delete-account-simple')

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: '帳號已成功註銷',
    })
  } catch (error) {
    return createErrorResponse(error, 'user:delete-account-simple')
  }
} 