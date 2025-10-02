import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 檢查是否為管理員
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'ALL'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // 建立查詢條件
    const where: any = {}
    if (status !== 'ALL') {
      where.status = status
    }

    // 獲取提領申請
    const [withdrawals, totalCount] = await Promise.all([
      prisma.withdrawalRequest.findMany({
        where,
        include: {
          partner: {
            include: {
              user: true
            }
          }
        },
        orderBy: {
          requestedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.withdrawalRequest.count({ where })
    ])

    // 計算分頁資訊
    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      withdrawals: withdrawals.map(withdrawal => ({
        id: withdrawal.id,
        partnerId: withdrawal.partnerId,
        partnerName: withdrawal.partner.name,
        partnerEmail: withdrawal.partner.user.email,
        amount: withdrawal.amount,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt.toISOString(),
        processedAt: withdrawal.processedAt?.toISOString(),
        adminNote: withdrawal.adminNote
      })),
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    })

  } catch (error) {
    console.error('獲取提領申請時發生錯誤:', error)
    return NextResponse.json({ error: '獲取提領申請失敗' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 檢查是否為管理員
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: '權限不足' }, { status: 403 })
    }

    const { withdrawalId, status, adminNote } = await request.json()

    if (!withdrawalId || !status) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    if (!['APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
      return NextResponse.json({ error: '無效的狀態' }, { status: 400 })
    }

    // 檢查提領申請是否存在
    const withdrawal = await prisma.withdrawalRequest.findUnique({
      where: { id: withdrawalId },
      include: {
        partner: {
          include: {
            user: true
          }
        }
      }
    })

    if (!withdrawal) {
      return NextResponse.json({ error: '找不到提領申請' }, { status: 404 })
    }

    if (withdrawal.status !== 'PENDING') {
      return NextResponse.json({ error: '該提領申請已被處理' }, { status: 400 })
    }

    // 更新提領申請狀態
    const updatedWithdrawal = await prisma.withdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        status: status as any,
        processedAt: new Date(),
        adminNote: adminNote || null
      }
    })

    // 記錄管理員操作
    console.log(`💰 管理員 ${user.email} 處理提領申請:`, {
      withdrawalId: withdrawal.id,
      partnerName: withdrawal.partner.name,
      partnerEmail: withdrawal.partner.user.email,
      amount: withdrawal.amount,
      status: status,
      adminNote: adminNote
    })

    return NextResponse.json({
      success: true,
      withdrawal: {
        id: updatedWithdrawal.id,
        status: updatedWithdrawal.status,
        processedAt: updatedWithdrawal.processedAt?.toISOString(),
        adminNote: updatedWithdrawal.adminNote
      },
      message: '提領申請狀態已更新'
    })

  } catch (error) {
    console.error('處理提領申請時發生錯誤:', error)
    return NextResponse.json({ error: '處理提領申請失敗' }, { status: 500 })
  }
}
