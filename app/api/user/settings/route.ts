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
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const settings = await db.query(async (client) => {
      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: {
          emailNotifications: true,
          messageNotifications: true,
          bookingNotifications: true,
          twoFactorEnabled: true,
          loginAlerts: true,
          securityAlerts: true,
        },
      })

      return {
        emailNotifications: user?.emailNotifications ?? true,
        messageNotifications: user?.messageNotifications ?? true,
        bookingNotifications: user?.bookingNotifications ?? true,
        twoFactorEnabled: user?.twoFactorEnabled ?? false,
        loginAlerts: user?.loginAlerts ?? true,
        securityAlerts: user?.securityAlerts ?? true,
      }
    }, 'user:settings:get')

    return NextResponse.json(settings)
  } catch (error) {
    return createErrorResponse(error, 'user:settings:get')
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const body = await request.json()
    const {
      emailNotifications,
      messageNotifications,
      bookingNotifications,
      twoFactorEnabled,
      loginAlerts,
      securityAlerts,
    } = body

    await db.query(async (client) => {
      await client.user.update({
        where: { id: session.user.id },
        data: {
          emailNotifications: emailNotifications ?? true,
          messageNotifications: messageNotifications ?? true,
          bookingNotifications: bookingNotifications ?? true,
          twoFactorEnabled: twoFactorEnabled ?? false,
          loginAlerts: loginAlerts ?? true,
          securityAlerts: securityAlerts ?? true,
        },
      })
    }, 'user:settings:update')

    return NextResponse.json({ message: '設定已更新' })
  } catch (error) {
    return createErrorResponse(error, 'user:settings:update')
  }
}
