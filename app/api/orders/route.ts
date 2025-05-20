import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '未授權' }, { status: 401 })
  }
  // 取得 customerId
  const customer = await prisma.customer.findUnique({ where: { userId: session.user.id } })
  if (!customer) return NextResponse.json({ orders: [] })
  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    include: { booking: { include: { schedule: { include: { partner: true } } } } }
  })
  return NextResponse.json({ orders })
} 