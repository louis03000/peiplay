import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const partner = await db.query(async (client) => {
      return client.partner.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          isAvailableNow: true,
        },
      })
    }, 'partner:dashboard-step2:get')

    return NextResponse.json({
      status: 'success',
      message: 'Database connection working',
      partner: partner || null,
    })
  } catch (error) {
    return createErrorResponse(error, 'partner:dashboard-step2:get')
  }
}
