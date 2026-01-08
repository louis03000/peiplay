import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'
import { sendWithdrawalApprovedEmail, sendWithdrawalRejectedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const { status, adminNote, rejectionReason } = await request.json()

    if (!['APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updatedWithdrawal = await db.query(async (client) => {
      const withdrawal = await client.withdrawalRequest.findUnique({
        where: { id },
        include: {
          partner: {
            select: {
              name: true,
              user: {
                select: { 
                  email: true,
                  name: true,
                },
              },
            },
          },
        },
      })

      if (!withdrawal) {
        throw new Error('找不到提領申請')
      }

      const updated = await client.withdrawalRequest.update({
        where: { id },
        data: {
          status,
          adminNote,
          rejectionReason: status === 'REJECTED' ? (rejectionReason || null) : null,
          processedAt: new Date(),
        },
        include: {
          partner: {
            include: {
              user: {
                select: { email: true },
              },
            },
          },
        },
      })

      // 發送郵件通知給夥伴（不阻塞響應）
      if (withdrawal.partner.user.email && withdrawal.partner.user.name) {
        if (status === 'APPROVED') {
          sendWithdrawalApprovedEmail(
            withdrawal.partner.user.email,
            withdrawal.partner.user.name,
            withdrawal.amount
          ).catch(error => {
            console.error('❌ 發送提領核准通知給夥伴失敗:', error)
          })
        } else if (status === 'REJECTED') {
          sendWithdrawalRejectedEmail(
            withdrawal.partner.user.email,
            withdrawal.partner.user.name,
            withdrawal.amount,
            rejectionReason || null
          ).catch(error => {
            console.error('❌ 發送提領拒絕通知給夥伴失敗:', error)
          })
        }
      }

      return updated
    }, 'admin:withdrawals:update')

    return NextResponse.json(updatedWithdrawal)
  } catch (error) {
    return createErrorResponse(error, 'admin:withdrawals:update')
  }
}
