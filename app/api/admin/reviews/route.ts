import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// 獲取待審核的評價
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const reviews = await prisma.review.findMany({
      where: {
        comment: {
          not: null
        }
      },
      include: {
        reviewer: {
          select: {
            name: true,
            email: true
          }
        },
        reviewee: {
          select: {
            name: true
          }
        },
        booking: {
          include: {
            schedule: {
              include: {
                partner: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ reviews })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: '獲取評價失敗' },
      { status: 500 }
    )
  }
}

// 審核評價（通過/拒絕）
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { reviewId, action } = await request.json()

    if (!reviewId || !action) {
      return NextResponse.json(
        { error: '缺少必要參數' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      const review = await prisma.review.update({
        where: { id: reviewId },
        data: {
          isApproved: true,
          approvedAt: new Date()
        }
      })

      return NextResponse.json({ 
        message: '評價已通過審核',
        review 
      })
    } else if (action === 'reject') {
      const review = await prisma.review.update({
        where: { id: reviewId },
        data: {
          isApproved: false,
          approvedAt: null
        }
      })

      return NextResponse.json({ 
        message: '評價已拒絕',
        review 
      })
    } else {
      return NextResponse.json(
        { error: '無效的操作' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error updating review:', error)
    return NextResponse.json(
      { error: '更新評價失敗' },
      { status: 500 }
    )
  }
}
