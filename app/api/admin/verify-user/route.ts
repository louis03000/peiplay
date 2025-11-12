import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: '缺少用戶ID' }, { status: 400 })
    }

    const user = await db.query(async (client) => {
      return client.user.update({
        where: { id: userId },
        data: { emailVerified: true },
        select: {
          id: true,
          email: true,
          name: true,
          emailVerified: true,
        },
      })
    }, 'admin:verify-user')

    return NextResponse.json({
      success: true,
      message: '用戶 Email 驗證成功',
      user,
    })
  } catch (error) {
    return createErrorResponse(error, 'admin:verify-user')
  }
}
