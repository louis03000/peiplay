import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('session.user.id', session?.user?.id);
    const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
    console.log('user 查詢結果', user);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    const url = new URL(request.url);
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const scheduleDateFilter = startDate && endDate ? {
      gt: new Date(startDate),
      lt: new Date(endDate),
    } : {
      gt: new Date(),
    };
    const partners = await prisma.partner.findMany({
      where: {
        status: 'APPROVED',
        schedules: {
          some: {
            date: scheduleDateFilter,
            isAvailable: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
        games: true,
        hourlyRate: true,
        coverImage: true,
        schedules: {
          where: {
            date: scheduleDateFilter,
            isAvailable: true,
          },
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(partners);
  } catch (error) {
    console.error("Error fetching partners:", error);
    return NextResponse.json({ error: "Error fetching partners" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let data = null;
  try {
    console.log('收到 POST /api/partners 請求');
    const session = await getServerSession(authOptions);
    console.log('session.user.id', session?.user?.id);
    const user = session?.user?.id ? await prisma.user.findUnique({ where: { id: session.user.id } }) : null;
    console.log('user 查詢結果', user);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    data = await request.json()
    // 驗證必填欄位（移除 userId）
    const requiredFields = ['name', 'birthday', 'phone', 'hourlyRate', 'games', 'coverImage']
    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }
    // 驗證生日不能是未來日期
    if (new Date(data.birthday) > new Date()) {
      return NextResponse.json(
        { error: '生日不能是未來日期' },
        { status: 400 }
      )
    }
    // 檢查是否已經申請過
    const exist = await prisma.partner.findUnique({ where: { userId: session.user.id } });
    if (exist) {
      return NextResponse.json(
        { error: '你已經申請過，不可重複申請' },
        { status: 400 }
      );
    }
    // 建立新夥伴
    const partner = await prisma.partner.create({
      data: {
        userId: session.user.id,
        name: data.name,
        birthday: new Date(data.birthday),
        phone: data.phone,
        hourlyRate: data.hourlyRate,
        games: data.games,
        coverImage: data.coverImage,
      },
    })
    return NextResponse.json(partner)
  } catch (error) {
    console.error('Error creating partner:', error, error instanceof Error ? error.stack : '', JSON.stringify(data))
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create partner' },
      { status: 500 }
    )
  }
}