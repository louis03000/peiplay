import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';


export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bookingId, rating, comment } = await request.json();
    if (!bookingId || !rating) {
      return NextResponse.json(
        { error: 'Booking ID and rating are required' },
        { status: 400 }
      );
    }

    // Get booking details and create review
    // 優化：使用 select 而非 include
    const review = await db.query(async (client) => {
      const booking = await client.booking.findUnique({
        where: { id: bookingId },
        select: {
          id: true,
          status: true,
          customer: {
            select: {
              id: true,
              userId: true,
            }
          },
          schedule: {
            select: {
              id: true,
              partnerId: true,
              partner: {
                select: {
                  id: true,
                  userId: true,
                }
              }
            }
          }
        }
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Check if user is authorized to review
      const isCustomer = booking.customer.userId === session.user.id;
      const isPartner = booking.schedule.partner.userId === session.user.id;

      if (!isCustomer && !isPartner) {
        throw new Error('Not authorized to review this booking');
      }

      // Create review
      return await client.review.create({
        data: {
          bookingId,
          reviewerId: session.user.id,
          revieweeId: isCustomer ? booking.schedule.partner.userId : booking.customer.userId,
          rating,
          comment
        }
      });
    });

    return NextResponse.json(review);
  } catch (error) {
    console.error('Review creation error:', error);
    if (error instanceof Error) {
      if (error.message === 'Booking not found') {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }
      if (error.message === 'Not authorized to review this booking') {
        return NextResponse.json(
          { error: 'Not authorized to review this booking' },
          { status: 403 }
        );
      }
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');
    const userId = searchParams.get('userId');

    if (!bookingId && !userId) {
      return NextResponse.json(
        { error: 'Either bookingId or userId is required' },
        { status: 400 }
      );
    }

    // 優化：避免 OR 條件，分別查詢後合併，以利用索引
    const reviews = await db.query(async (client) => {
      if (bookingId && userId) {
        // 如果兩個參數都有，分別查詢後合併去重
        const [byBookingId, byUserId] = await Promise.all([
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
              updatedAt: true,
              reviewer: {
                select: {
                  id: true,
                  name: true,
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }),
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
              updatedAt: true,
              reviewer: {
                select: {
                  id: true,
                  name: true,
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          })
        ]);
        // 合併並去重
        const reviewMap = new Map();
        [...byBookingId, ...byUserId].forEach(review => {
          reviewMap.set(review.id, review);
        });
        return Array.from(reviewMap.values()).sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      } else {
        return await client.review.findMany({
          where: {
            ...(bookingId ? { bookingId } : {}),
            ...(userId ? { revieweeId: userId } : {})
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
            updatedAt: true,
            reviewer: {
              select: {
                id: true,
                name: true,
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 100, // 限制結果數量
        });
      }
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Review fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 