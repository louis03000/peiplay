import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const withdrawals = await db.query(async (client) => {
      return client.withdrawalRequest.findMany({
        include: {
          partner: {
            include: {
              user: {
                select: { email: true },
              },
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
      })
    }, 'admin:withdrawals:get')

    return NextResponse.json(withdrawals)
  } catch (error) {
    return createErrorResponse(error, 'admin:withdrawals:get')
  }
}

