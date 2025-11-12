import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const user = await client.user.findUnique({ where: { id: session.user.id } })
      if (!user || user.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const
      }

      const { searchParams } = new URL(request.url)
      const status = searchParams.get('status') || 'ALL'
      const page = parseInt(searchParams.get('page') || '1')
      const limit = parseInt(searchParams.get('limit') || '10')
      const skip = (page - 1) * limit

      const where: Record<string, unknown> = {}
      if (status !== 'ALL') {
        where.status = status
      }

      const [withdrawals, totalCount] = await Promise.all([
        client.withdrawalRequest.findMany({
          where,
          include: {
            partner: {
              include: { user: true },
            },
          },
          orderBy: { requestedAt: 'desc' },
          skip,
          take: limit,
        }),
        client.withdrawalRequest.count({ where }),
      ])

      const totalPages = Math.ceil(totalCount / limit)

      return {
        type: 'SUCCESS',
        payload: {
          withdrawals: withdrawals.map((withdrawal) => ({
            id: withdrawal.id,
            partnerId: withdrawal.partnerId,
            partnerName: withdrawal.partner.name,
            partnerEmail: withdrawal.partner.user.email,
            amount: withdrawal.amount,
            status: withdrawal.status,
            requestedAt: withdrawal.requestedAt.toISOString(),
            processedAt: withdrawal.processedAt?.toISOString(),
            adminNote: withdrawal.adminNote,
          })),
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
          },
        },
      }
    }, 'admin:withdrawal-requests:get')

    if (result.type === 'NOT_ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    return NextResponse.json(result.payload)
  } catch (error) {
    return createErrorResponse(error, 'admin:withdrawal-requests:get')
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const { withdrawalId, status, adminNote } = await request.json()

    if (!withdrawalId || !status) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    if (!['APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
      return NextResponse.json({ error: '無效的狀態' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const user = await client.user.findUnique({ where: { id: session.user.id } })
      if (!user || user.role !== 'ADMIN') {
        return { type: 'NOT_ADMIN' } as const
      }

      const withdrawal = await client.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
        include: {
          partner: {
            include: { user: true },
          },
        },
      })

      if (!withdrawal) {
        return { type: 'NOT_FOUND' } as const
      }

      if (withdrawal.status !== 'PENDING') {
        return { type: 'ALREADY_PROCESSED' } as const
      }

      const updatedWithdrawal = await client.withdrawalRequest.update({
        where: { id: withdrawalId },
        data: {
          status,
          processedAt: new Date(),
          adminNote: adminNote || null,
        },
      })

      console.log(`💰 管理員 ${user.email} 處理提領申請:`, {
        withdrawalId: withdrawal.id,
        partnerName: withdrawal.partner.name,
        partnerEmail: withdrawal.partner.user.email,
        amount: withdrawal.amount,
        status,
        adminNote,
      })

      return {
        type: 'SUCCESS',
        payload: {
          id: updatedWithdrawal.id,
          status: updatedWithdrawal.status,
          processedAt: updatedWithdrawal.processedAt?.toISOString(),
          adminNote: updatedWithdrawal.adminNote,
        },
      }
    }, 'admin:withdrawal-requests:put')

    switch (result.type) {
      case 'NOT_ADMIN':
        return NextResponse.json({ error: '權限不足' }, { status: 403 })
      case 'NOT_FOUND':
        return NextResponse.json({ error: '找不到提領申請' }, { status: 404 })
      case 'ALREADY_PROCESSED':
        return NextResponse.json({ error: '該提領申請已被處理' }, { status: 400 })
      case 'SUCCESS':
        return NextResponse.json({
          success: true,
          withdrawal: result.payload,
          message: '提領申請狀態已更新',
        })
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 })
    }
  } catch (error) {
    return createErrorResponse(error, 'admin:withdrawal-requests:put')
  }
}
