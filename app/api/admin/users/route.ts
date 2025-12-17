import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    const users = await db.query(async (client) => {
      return client.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          isSuspended: true,
          suspensionEndsAt: true,
          suspensionReason: true,
          partner: {
            select: {
              id: true,
              status: true,
              games: true,
              halfHourlyRate: true,
              contractFile: true,
            },
          },
          customer: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })
    }, 'admin:users:list')

    return NextResponse.json(users)
  } catch (error) {
    return createErrorResponse(error, 'admin:users:list')
  }
}