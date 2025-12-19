import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      // 返回所有提領記錄（永久保存，不限制數量）
      const withdrawals = await client.withdrawalRequest.findMany({
        where: { partnerId: partner.id },
        orderBy: { requestedAt: 'desc' },
        // 移除 take 限制，返回所有記錄
        select: {
          id: true,
          amount: true,
          status: true,
          requestedAt: true,
          processedAt: true,
          adminNote: true,
        },
      })

      return {
        type: 'SUCCESS',
        withdrawals: withdrawals.map((withdrawal) => ({
          id: withdrawal.id,
          amount: withdrawal.amount,
          status: withdrawal.status,
          requestedAt: withdrawal.requestedAt.toISOString(),
          processedAt: withdrawal.processedAt?.toISOString(),
          adminNote: withdrawal.adminNote,
        })),
      }
    }, 'partners:withdrawal:history')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    return NextResponse.json({ withdrawals: result.withdrawals })
  } catch (error) {
    return createErrorResponse(error, 'partners:withdrawal:history')
  }
}
