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

    const customer = await db.query(async (client) => {
      return client.customer.findUnique({
        where: { userId: session.user.id },
        select: {
          name: true,
          birthday: true,
          phone: true,
          user: { select: { email: true, id: true } },
        },
      })
    }, 'customer:me:get')

    if (!customer) {
      return NextResponse.json({ error: '找不到客戶資料' }, { status: 404 })
    }

    return NextResponse.json({
      name: customer.name,
      birthday: customer.birthday,
      phone: customer.phone,
      email: customer.user.email,
      userId: customer.user.id,
    })
  } catch (error) {
    return createErrorResponse(error, 'customer:me:get')
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const data = await request.json()
    const { name, phone, birthday, email } = data

    if (!name || !phone || !birthday || !email) {
      return NextResponse.json({ error: '所有欄位皆為必填' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const existingUser = await client.user.findFirst({
        where: {
          email,
          id: { not: session.user.id },
        },
      })

      if (existingUser) {
        return { type: 'EMAIL_IN_USE' } as const
      }

      await client.$transaction(async (tx) => {
        await tx.customer.update({
          where: { userId: session.user.id },
          data: {
            name,
            phone,
            birthday: new Date(birthday),
          },
        })

        await tx.user.update({
          where: { id: session.user.id },
          data: { email },
        })
      })

      return { type: 'SUCCESS' } as const
    }, 'customer:me:update')

    if (result.type === 'EMAIL_IN_USE') {
      return NextResponse.json({ error: '此 Email 已被其他用戶使用' }, { status: 400 })
    }

    return NextResponse.json({ message: '更新成功' })
  } catch (error) {
    return createErrorResponse(error, 'customer:me:update')
  }
} 