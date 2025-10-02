import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

    // 獲取當前用戶的 partner 信息
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    })

    if (!partner) {
      return NextResponse.json(
        { error: '找不到夥伴信息' },
        { status: 404 }
      )
    }

    // 刪除選中的時段
    await prisma.schedule.deleteMany({
      where: {
        id: { in: ids },
        partnerId: partner.id,
      },
    })

    return NextResponse.json({ message: '批量刪除成功' })
  } catch (error) {
    console.error('Error batch deleting schedules:', error)
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

    // 獲取當前用戶的 partner 信息
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
    })

    if (!partner) {
      return NextResponse.json(
        { error: '找不到夥伴信息' },
        { status: 404 }
      )
    }

    // 更新選中時段的狀態
    await prisma.schedule.updateMany({
      where: {
        id: { in: ids },
        partnerId: partner.id,
      },
      data: {
        isAvailable,
      },
    })

    return NextResponse.json({ message: '批量更新成功' })
  } catch (error) {
    console.error('Error batch updating schedules:', error)
    return NextResponse.json(
      { error: '批量更新時段失敗' },
      { status: 500 }
    )
  }
} 