import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Get booking details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        schedule: {
          include: {
            partner: true
          }
        }
      }
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check if user is authorized to review
    const isCustomer = booking.customer.userId === session.user.id;
    const isPartner = booking.schedule.partner.userId === session.user.id;

    if (!isCustomer && !isPartner) {
      return NextResponse.json(
        { error: 'Not authorized to review this booking' },
        { status: 403 }
      );
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        bookingId,
        reviewerId: session.user.id,
        revieweeId: isCustomer ? booking.schedule.partner.userId : booking.customer.userId,
        rating,
        comment
      }
    });

    return NextResponse.json(review);
  } catch (error) {
    console.error('Review creation error:', error);
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

    const reviews = await prisma.review.findMany({
      where: {
        OR: [
          { bookingId: bookingId || undefined },
          { revieweeId: userId || undefined }
        ]
      },
      include: {
        reviewer: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
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