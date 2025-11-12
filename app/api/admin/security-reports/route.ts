import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const reports = await db.query(async (client) => {
      return client.securityLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      })
    }, 'admin:security-reports:get')

    return NextResponse.json({ reports })
  } catch (error) {
    return createErrorResponse(error, 'admin:security-reports:get')
  }
}
