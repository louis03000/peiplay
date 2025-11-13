import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export const dynamic = 'force-dynamic';
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { ids } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '無效的時段 ID' },
        { status: 400 }
      )
    }

    const result = await db.query(async (client) => {
      // 獲取當前用戶的 partner 信息
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
      })

      if (!partner) {
        throw new Error('找不到夥伴信息')
      }

      // 刪除選中的時段
      await client.schedule.deleteMany({
        where: {
          id: { in: ids },
          partnerId: partner.id,
        },
      })

      return { message: '批量刪除成功' }
    }, 'schedules/batch:DELETE')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error batch deleting schedules:', error)
    if (error instanceof NextResponse) {
      return error
    }
    return NextResponse.json(
      { error: '批量刪除時段失敗' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { ids, isAvailable } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0 || typeof isAvailable !== 'boolean') {
      return NextResponse.json(
        { error: '無效的請求數據' },
        { status: 400 }
      )
    }

    const result = await db.query(async (client) => {
      // 獲取當前用戶的 partner 信息
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
      })

      if (!partner) {
        throw new Error('找不到夥伴信息')
      }

      // 更新選中時段的狀態
      await client.schedule.updateMany({
        where: {
          id: { in: ids },
          partnerId: partner.id,
        },
        data: {
          isAvailable,
        },
      })

      return { message: '批量更新成功' }
    }, 'schedules/batch:PUT')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error batch updating schedules:', error)
    if (error instanceof NextResponse) {
      return error
    }
    return NextResponse.json(
      { error: '批量更新時段失敗' },
      { status: 500 }
    )
  }
} 