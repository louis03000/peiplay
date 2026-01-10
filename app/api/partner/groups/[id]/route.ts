import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { id: groupId } = await params

    if (!groupId) {
      return NextResponse.json({ error: '缺少群組 ID' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      try {
        // 查找夥伴
        const partner = await client.partner.findUnique({
          where: { userId: session.user.id },
        })

        if (!partner) {
          return { type: 'NOT_PARTNER' } as const
        }

        // 查找群組預約
        const groupBooking = await client.groupBooking.findUnique({
          where: { id: groupId },
          include: {
            _count: {
              select: { GroupBookingParticipant: true },
            },
          },
        })

        if (!groupBooking) {
          return { type: 'NOT_FOUND' } as const
        }

        // 檢查是否為群組創建者
        if (
          groupBooking.initiatorId !== partner.id ||
          groupBooking.initiatorType !== 'PARTNER'
        ) {
          return { type: 'FORBIDDEN' } as const
        }

        // 檢查是否有參與者（除了創建者/夥伴自己）
        // maxParticipants 表示除了夥伴之外的參與者數量
        // 如果 currentParticipants > 1，表示除了夥伴之外還有其他參與者
        const participantCount = groupBooking._count.GroupBookingParticipant || 0
        // 夥伴自己也算一個參與者，所以如果 participantCount > 1，表示有其他參與者
        if (participantCount > 1) {
          return { type: 'HAS_PARTICIPANTS' } as const
        }

        // 檢查狀態（只有在 ACTIVE 狀態才能取消）
        if (groupBooking.status !== 'ACTIVE') {
          return { type: 'INVALID_STATUS' } as const
        }

        // 在事務中更新群組狀態為 CANCELLED
        await client.$transaction(async (tx) => {
          // 更新群組狀態
          await tx.groupBooking.update({
            where: { id: groupId },
            data: { status: 'CANCELLED' },
          })

          // 取消所有參與者記錄（如果有）
          await tx.groupBookingParticipant.updateMany({
            where: {
              groupBookingId: groupId,
              status: 'ACTIVE',
            },
            data: { status: 'CANCELLED' },
          })
        })

        return { type: 'SUCCESS' } as const
      } catch (queryError: any) {
        console.error('❌ 取消群組預約時發生錯誤:', {
          message: queryError?.message,
          code: queryError?.code,
          meta: queryError?.meta,
        })
        throw queryError
      }
    }, 'partner:groups:delete')

    if (result && typeof result === 'object' && 'type' in result) {
      if (result.type === 'NOT_PARTNER') {
        return NextResponse.json({ error: '夥伴資料不存在' }, { status: 404 })
      }
      if (result.type === 'NOT_FOUND') {
        return NextResponse.json({ error: '群組預約不存在' }, { status: 404 })
      }
      if (result.type === 'FORBIDDEN') {
        return NextResponse.json({ error: '您沒有權限取消此群組' }, { status: 403 })
      }
      if (result.type === 'HAS_PARTICIPANTS') {
        return NextResponse.json(
          { error: '已有用戶加入此群組，無法取消' },
          { status: 400 }
        )
      }
      if (result.type === 'INVALID_STATUS') {
        return NextResponse.json(
          { error: '此群組狀態不允許取消' },
          { status: 400 }
        )
      }
      if (result.type === 'SUCCESS') {
        return NextResponse.json({ message: '群組預約已成功取消' })
      }
    }

    // 如果結果格式不正確
    console.error('❌ 結果格式不正確:', result)
    return NextResponse.json({ error: '資料庫操作失敗' }, { status: 500 })
  } catch (error) {
    console.error('❌ 取消群組預約失敗:', error)
    console.error('錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    return createErrorResponse(error, 'partner:groups:delete')
  }
}
