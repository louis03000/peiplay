import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const status = statusParam === 'PENDING' || statusParam === 'APPROVED' || statusParam === 'REJECTED' ? statusParam : undefined

    const partners = await db.query(async (client) => {
      return client.partner.findMany({
        where: status ? { status } : undefined,
        include: { user: true },
        orderBy: { createdAt: 'desc' },
      })
    }, 'admin:partners:get')

    return NextResponse.json(partners)
  } catch (error) {
    return createErrorResponse(error, 'admin:partners:get')
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 403 })
    }

    const { id, status } = await request.json()

    if (!id || (status !== 'APPROVED' && status !== 'REJECTED')) {
      return NextResponse.json({ error: '參數錯誤' }, { status: 400 })
    }

    const partner = await db.query(async (client) => {
      return client.partner.update({
        where: { id },
        data: { status },
        include: { user: true },
      })
    }, 'admin:partners:update-status')

    return NextResponse.json(partner)
  } catch (error) {
    return createErrorResponse(error, 'admin:partners:update-status')
  }
} 