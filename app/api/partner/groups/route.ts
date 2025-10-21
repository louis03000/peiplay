import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 獲取夥伴的群組預約
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    });

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 });
    }

    const groups = await prisma.groupBooking.findMany({
      where: { partnerId: partner.id },
      include: {
        bookings: {
          include: {
            customer: {
              include: { user: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(groups);

  } catch (error) {
    console.error('Error fetching partner groups:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// 創建新的群組預約
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: { id: true, allowGroupBooking: true }
    });

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 });
    }

    if (!partner.allowGroupBooking) {
      return NextResponse.json({ error: '您尚未啟用群組預約功能' }, { status: 400 });
    }

    const { title, description, date, startTime, endTime, pricePerPerson, maxParticipants } = await request.json();

    // 驗證必要欄位
    if (!title || !date || !startTime || !endTime || !pricePerPerson || !maxParticipants) {
      return NextResponse.json({ error: '請填寫所有必要欄位' }, { status: 400 });
    }

    if (maxParticipants > 9) {
      return NextResponse.json({ error: '最大人數不能超過9人' }, { status: 400 });
    }

    // 組合開始和結束時間
    const startDateTime = new Date(`${date}T${startTime}`);
    const endDateTime = new Date(`${date}T${endTime}`);

    // 檢查時間是否為未來
    if (startDateTime <= new Date()) {
      return NextResponse.json({ error: '開始時間必須是未來時間' }, { status: 400 });
    }

    if (startDateTime >= endDateTime) {
      return NextResponse.json({ error: '開始時間必須早於結束時間' }, { status: 400 });
    }

    // 創建群組預約
    const groupBooking = await prisma.groupBooking.create({
      data: {
        partnerId: partner.id,
        creatorId: session.user.id, // 夥伴自己作為創建者
        title,
        description: description || null,
        maxParticipants,
        currentParticipants: 1, // 夥伴自己算1人
        pricePerPerson,
        startTime: startDateTime,
        endTime: endDateTime,
        status: 'ACTIVE',
        // 這裡可以添加 Discord 頻道相關的欄位
        discordTextChannelId: null,
        discordVoiceChannelId: null
      },
      include: {
        partner: {
          select: { name: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      groupBooking
    });

  } catch (error) {
    console.error('Error creating group booking:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
