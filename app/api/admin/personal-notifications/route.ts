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
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const notifications = await db.query(async (client) => {
      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })

      if (!user || user.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const
      }

      const records = await client.personalNotification.findMany({
        orderBy: { createdAt: 'desc' },
      })

      return { type: 'SUCCESS', records } as const
    }, 'admin:personal-notifications:get')

    if (notifications.type === 'NOT_ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    return NextResponse.json(notifications.records)
  } catch (error) {
    return createErrorResponse(error, 'admin:personal-notifications:get')
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const { title, message, userId } = await request.json()

    if (!title || !message || !userId) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })

      if (!user || user.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const
      }

      const notification = await client.personalNotification.create({
        data: {
          title,
          message,
          userId,
        },
      })

      return { type: 'SUCCESS', notification } as const
    }, 'admin:personal-notifications:create')

    if (result.type === 'NOT_ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    return NextResponse.json(result.notification)
  } catch (error) {
    return createErrorResponse(error, 'admin:personal-notifications:create')
  }
}
