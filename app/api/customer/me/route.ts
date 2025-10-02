import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }
    const customer = await prisma.customer.findUnique({
      where: { userId: session.user.id },
      select: {
        name: true,
        birthday: true,
        phone: true,
        user: { select: { email: true, id: true } },
      },
    })
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
  } catch {
    return NextResponse.json({ error: '獲取客戶資料失敗' }, { status: 500 })
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
    // 檢查 email 是否已被其他用戶使用
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        id: { not: session.user.id },
      },
    })
    if (existingUser) {
      return NextResponse.json({ error: '此 Email 已被其他用戶使用' }, { status: 400 })
    }
    // 更新 customer
    await prisma.customer.update({
      where: { userId: session.user.id },
      data: {
        name,
        phone,
        birthday: new Date(birthday),
      },
    })
    // 同步更新 user.email
    await prisma.user.update({
      where: { id: session.user.id },
      data: { email },
    })
    return NextResponse.json({ message: '更新成功' })
  } catch {
    return NextResponse.json({ error: '更新失敗' }, { status: 500 })
  }
} 