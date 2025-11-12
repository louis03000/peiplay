import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { status, adminNote } = await request.json()

    if (!['APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updatedWithdrawal = await db.query(async (client) => {
      return client.withdrawalRequest.update({
        where: { id },
        data: {
          status,
          adminNote,
          processedAt: new Date(),
        },
        include: {
          partner: {
            include: {
              user: {
                select: { email: true },
              },
            },
          },
        },
      })
    }, 'admin:withdrawals:update')

    return NextResponse.json(updatedWithdrawal)
  } catch (error) {
    return createErrorResponse(error, 'admin:withdrawals:update')
  }
}
