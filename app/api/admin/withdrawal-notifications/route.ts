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

    // 獲取所有待審核的提領申請
    const pendingWithdrawals = await prisma.withdrawalRequest.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        partner: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        requestedAt: 'asc'
      }
    })

    // 為每個提領申請獲取詳細統計
    const withdrawalsWithStats = await Promise.all(
      pendingWithdrawals.map(async (withdrawal) => {
        const [totalEarnings, totalOrders, recentBookings] = await Promise.all([
          // 總收入
          prisma.booking.aggregate({
            where: {
              schedule: {
                partnerId: withdrawal.partnerId
              },
              status: {
                in: ['COMPLETED', 'CONFIRMED']
              }
            },
            _sum: {
              finalAmount: true
            }
          }),
          // 總接單數
          prisma.booking.count({
            where: {
              schedule: {
                partnerId: withdrawal.partnerId
              },
              status: {
                in: ['COMPLETED', 'CONFIRMED']
              }
            }
          }),
          // 最近5筆訂單
          prisma.booking.findMany({
            where: {
              schedule: {
                partnerId: withdrawal.partnerId
              },
              status: {
                in: ['COMPLETED', 'CONFIRMED']
              }
            },
            include: {
              customer: {
                include: {
                  user: true
                }
              },
              schedule: true
            },
            orderBy: {
              createdAt: 'desc'
            },
            take: 5
          })
        ])

        const totalEarningsAmount = totalEarnings._sum.finalAmount || 0
        const totalWithdrawn = await prisma.withdrawalRequest.aggregate({
          where: {
            partnerId: withdrawal.partnerId,
            status: {
              in: ['APPROVED', 'COMPLETED']
            }
          },
          _sum: {
            amount: true
          }
        })

        const totalWithdrawnAmount = totalWithdrawn._sum.amount || 0
        
        // 獲取夥伴的推薦收入
        const partnerData = await prisma.partner.findUnique({
          where: { id: withdrawal.partnerId },
          select: { referralEarnings: true }
        });
        const referralEarnings = partnerData?.referralEarnings || 0;

        // 平台抽成比例
        const PLATFORM_FEE_PERCENTAGE = 0.15; // 15%

        // 計算可提領餘額：
        // 1. 夥伴收入 = 總收入 * (1 - 平台抽成15%) = 總收入 * 85%
        // 2. 加上推薦收入
        // 3. 減去已提領金額
        const partnerEarnings = totalEarningsAmount * (1 - PLATFORM_FEE_PERCENTAGE);
        const availableBalance = partnerEarnings + referralEarnings - totalWithdrawnAmount;

        return {
          id: withdrawal.id,
          partnerId: withdrawal.partnerId,
          partnerName: withdrawal.partner.name,
          partnerEmail: withdrawal.partner.user.email,
          amount: withdrawal.amount,
          requestedAt: withdrawal.requestedAt,
          stats: {
            totalEarnings: totalEarningsAmount,
            totalOrders: totalOrders,
            availableBalance: availableBalance,
            recentBookings: recentBookings.map(b => ({
              orderNumber: b.orderNumber,
              customerName: b.customer.user.name,
              amount: b.finalAmount,
              date: b.createdAt,
              startTime: b.schedule.startTime,
              endTime: b.schedule.endTime
            }))
          }
        }
      })
    )

    return NextResponse.json({
      pendingWithdrawals: withdrawalsWithStats,
      total: withdrawalsWithStats.length
    })

  } catch (error) {
    console.error('獲取提領通知時發生錯誤:', error)
    return NextResponse.json({ error: '獲取提領通知失敗' }, { status: 500 })
  }
}
