import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'


export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    const { bookingId, revieweeId, rating, comment } = await request.json()

    const result = await db.query(async (client) => {
      // 檢查是否已評價過
      const existingReview = await client.review.findFirst({
        where: {
          bookingId,
          reviewerId: session.user.id,
          revieweeId
        }
      })

      if (existingReview) {
        throw new Error('已經評價過此預約')
      }

      // 檢查預約是否存在且已完成
      // 優化：使用 select 而非 include
      const booking = await client.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          status: true,
          schedule: {
            select: {
              id: true,
              partnerId: true,
              date: true,
              startTime: true,
              endTime: true,
            }
          }
        }
      })

      if (!booking) {
        throw new Error('預約不存在')
      }

      if (booking.status !== 'COMPLETED') {
        throw new Error('只能評價已完成的預約')
      }

      // 優化：使用 select 而非 include
      const review = await client.review.create({
        data: {
          bookingId,
          reviewerId: session.user.id,
          revieweeId,
          rating,
          comment
        },
        select: {
          id: true,
          bookingId: true,
          reviewerId: true,
          revieweeId: true,
          rating: true,
          comment: true,
          isApproved: true,
          createdAt: true,
          approvedAt: true,
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          },
          reviewee: {
            select: {
              id: true,
              name: true,
            }
          }
        }
      })

      return { review }
    }, 'reviews:POST')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error creating review:', error)
    if (error instanceof NextResponse) {
      return error
    }
    const errorMessage = error instanceof Error ? error.message : '創建評價失敗'
    const status = errorMessage.includes('已經評價') || errorMessage.includes('只能評價') ? 400 :
                   errorMessage.includes('不存在') ? 404 : 500
    return NextResponse.json(
      { error: errorMessage },
      { status }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const bookingId = searchParams.get('bookingId')

    if (!userId && !bookingId) {
      return NextResponse.json({ error: '需要提供 userId 或 bookingId' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      // 優化：使用 select 而非 include，只查詢必要欄位
      // 優化：分別查詢以利用索引，避免 OR 條件影響索引使用
      let reviews;
      if (userId && bookingId) {
        // 如果兩個參數都有，分別查詢後合併去重
        const [byUserId, byBookingId] = await Promise.all([
          client.review.findMany({
            where: { revieweeId: userId },
            select: {
              id: true,
              bookingId: true,
              reviewerId: true,
              revieweeId: true,
              rating: true,
              comment: true,
              isApproved: true,
              createdAt: true,
              approvedAt: true,
              reviewer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                }
              },
              reviewee: {
                select: {
                  id: true,
                  name: true,
                }
              },
              booking: {
                select: {
                  id: true,
                  status: true,
                  schedule: {
                    select: {
                      id: true,
                      date: true,
                      startTime: true,
                      endTime: true,
                    }
                  }
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }),
          client.review.findMany({
            where: { bookingId },
            select: {
              id: true,
              bookingId: true,
              reviewerId: true,
              revieweeId: true,
              rating: true,
              comment: true,
              isApproved: true,
              createdAt: true,
              approvedAt: true,
              reviewer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                }
              },
              reviewee: {
                select: {
                  id: true,
                  name: true,
                }
              },
              booking: {
                select: {
                  id: true,
                  status: true,
                  schedule: {
                    select: {
                      id: true,
                      date: true,
                      startTime: true,
                      endTime: true,
                    }
                  }
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          })
        ]);
        // 合併並去重
        const reviewMap = new Map();
        [...byUserId, ...byBookingId].forEach(review => {
          reviewMap.set(review.id, review);
        });
        reviews = Array.from(reviewMap.values()).sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else {
        reviews = await client.review.findMany({
          where: {
            ...(userId ? { revieweeId: userId } : {}),
            ...(bookingId ? { bookingId } : {})
          },
          select: {
            id: true,
            bookingId: true,
            reviewerId: true,
            revieweeId: true,
            rating: true,
            comment: true,
            isApproved: true,
            createdAt: true,
            approvedAt: true,
            reviewer: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            },
            reviewee: {
              select: {
                id: true,
                name: true,
              }
            },
            booking: {
              select: {
                id: true,
                status: true,
                schedule: {
                  select: {
                    id: true,
                    date: true,
                    startTime: true,
                    endTime: true,
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 100, // 限制結果數量
        });
      }

      return { reviews }
    }, 'reviews:GET')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching reviews:', error)
    if (error instanceof NextResponse) {
      return error
    }
    return NextResponse.json(
      { error: '獲取評價失敗' },
      { status: 500 }
    )
  }
} 