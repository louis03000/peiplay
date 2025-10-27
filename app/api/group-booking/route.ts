import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 創建群組預約
export async function POST(request: Request) {
  try {
    console.log("✅ group-booking POST api triggered");
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }

    const { partnerId, title, description, maxParticipants, pricePerPerson, startTime, endTime } = await request.json();

    if (!partnerId || !title || !startTime || !endTime || !pricePerPerson) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 確保資料庫連線
    await prisma.$connect();

    // 查找夥伴資料
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return NextResponse.json({ error: '夥伴不存在' }, { status: 404 });
    }

    // 創建群組預約
    const groupBooking = await prisma.groupBooking.create({
      data: {
        partnerId: partner.id,
        title,
        description: description || null,
        maxParticipants: maxParticipants || 4,
        pricePerPerson,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: 'ACTIVE'
      },
      include: {
        partner: {
          include: {
            user: true
          }
        }
      }
    });

    console.log("✅ 群組預約創建成功:", groupBooking.id);

    return NextResponse.json({
      success: true,
      groupBooking: {
        id: groupBooking.id,
        partnerId: groupBooking.partnerId,
        title: groupBooking.title,
        description: groupBooking.description,
        maxParticipants: groupBooking.maxParticipants,
        currentParticipants: 1, // 創建者算一個
        pricePerPerson: groupBooking.pricePerPerson,
        startTime: groupBooking.startTime.toISOString(),
        endTime: groupBooking.endTime.toISOString(),
        status: groupBooking.status,
        createdAt: groupBooking.createdAt.toISOString(),
        partner: {
          id: groupBooking.partner.id,
          name: groupBooking.partner.name,
          user: {
            name: groupBooking.partner.user.name
          }
        }
      }
    });

  } catch (error) {
    console.error('創建群組預約失敗:', error);
    return NextResponse.json({ 
      error: '創建群組預約失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    // 確保斷開連線
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}

// 獲取群組預約列表
export async function GET(request: Request) {
  try {
    console.log("✅ group-booking GET api triggered");
    
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');
    const status = searchParams.get('status');

    // 確保資料庫連線
    await prisma.$connect();

    // 構建查詢條件
    const where: any = {};
    if (partnerId) {
      where.partnerId = partnerId;
    }
    if (status) {
      where.status = status;
    }

    // 查詢群組預約
    const groupBookings = await prisma.groupBooking.findMany({
      where,
      include: {
        partner: {
          include: {
            user: true
          }
        },
        bookings: {
          include: {
            customer: {
              include: {
                user: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log("📊 找到群組預約:", groupBookings.length);

    // 格式化返回數據
    const formattedGroupBookings = groupBookings.map(group => ({
      id: group.id,
      partnerId: group.partnerId,
      title: group.title,
      description: group.description,
      maxParticipants: group.maxParticipants,
      currentParticipants: group.bookings.length + 1, // 參與者 + 創建者
      pricePerPerson: group.pricePerPerson,
      startTime: group.startTime.toISOString(),
      endTime: group.endTime.toISOString(),
      status: group.status,
      createdAt: group.createdAt.toISOString(),
      partner: {
        id: group.partner.id,
        name: group.partner.name,
        user: {
          name: group.partner.user.name
        }
      },
      bookings: group.bookings.map(booking => ({
        id: booking.id,
        customer: {
          id: booking.customer.id,
          user: {
            name: booking.customer.user.name,
            email: booking.customer.user.email
          }
        }
      }))
    }));

    return NextResponse.json(formattedGroupBookings);

  } catch (error) {
    console.error('獲取群組預約失敗:', error);
    return NextResponse.json({ 
      error: '獲取群組預約失敗',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    // 確保斷開連線
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("❌ 斷開連線失敗:", disconnectError);
    }
  }
}
