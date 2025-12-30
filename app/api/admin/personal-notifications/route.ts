import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { sendNotificationToEmail } from '@/lib/email'
import { NotificationType } from '@/lib/messaging'

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

    const { title, message, content, userId, type = 'INFO', priority = 'MEDIUM', isImportant = false, expiresAt, sendEmail = false } = await request.json()

    const notificationContent = content ?? message

    if (!title || !notificationContent || !userId) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    const validTypes = ['WARNING', 'VIOLATION', 'REMINDER', 'INFO', 'SYSTEM']
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: '無效的通知類型' }, { status: 400 })
    }

    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ error: '無效的通知優先級' }, { status: 400 })
    }

    let expiresDate: Date | undefined
    if (expiresAt) {
      const parsed = new Date(expiresAt)
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: '無效的到期時間格式' }, { status: 400 })
      }
      expiresDate = parsed
    }

    const result = await db.query(async (client) => {
      const user = await client.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })

      if (!user || user.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const
      }

      // 獲取接收通知的用戶信息（用於發送 Email）
      const targetUser = await client.user.findUnique({
        where: { id: userId },
        select: {
          email: true,
          name: true,
        },
      })

      const notification = await client.personalNotification.create({
        data: {
          title,
          content: notificationContent,
          userId,
          senderId: session.user.id,
          type,
          priority,
          isImportant,
          expiresAt: expiresDate,
        },
      })

      return { type: 'SUCCESS', notification, targetUser } as const
    }, 'admin:personal-notifications:create')

    if (result.type === 'NOT_ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    // 🔥 如果選擇了發送 Email，發送郵件通知
    if (sendEmail && result.targetUser?.email) {
      try {
        // 將 PersonalNotification 的類型映射到 NotificationType
        // 所有個人通知都使用 SYSTEM_ANNOUNCEMENT 類型
        const emailNotificationType: NotificationType = 'SYSTEM_ANNOUNCEMENT'
        
        await sendNotificationToEmail(
          result.targetUser.email,
          result.targetUser.name || '用戶',
          {
            type: emailNotificationType,
            title,
            content: notificationContent,
            createdAt: new Date().toISOString(),
          }
        )
        console.log(`✅ 個人通知 Email 已發送: ${result.targetUser.email} - ${title}`)
      } catch (emailError) {
        console.error('❌ 發送個人通知 Email 失敗:', emailError)
        // 不阻止通知創建，只記錄錯誤
      }
    } else if (sendEmail && !result.targetUser?.email) {
      console.warn(`⚠️ 用戶 ${userId} 沒有 Email 地址，無法發送郵件通知`)
    }

    return NextResponse.json(result.notification)
  } catch (error) {
    return createErrorResponse(error, 'admin:personal-notifications:create')
  }
}
