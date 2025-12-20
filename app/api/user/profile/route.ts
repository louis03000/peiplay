import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }

  try {
    const data = await request.json();
    const { name, phone, birthday, discord, customerMessage, games, coverImage, coverImages } = data;

    if (!name || !phone || !birthday) {
      return NextResponse.json({ error: '缺少必要欄位' }, { status: 400 });
    }

    let date: Date | null = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      const [year, month, day] = birthday.split('-');
      date = new Date(Number(year), Number(month) - 1, Number(day));
    } else {
      date = new Date(birthday);
    }
    if (!date || isNaN(date.getTime())) {
      return NextResponse.json({ error: '生日格式錯誤，請用 YYYY-MM-DD' }, { status: 400 });
    }

    const result = await db.query(async (client) => {
      const existingUser = await client.user.findFirst({
        where: {
          OR: [
            { id: session.user.id },
            { email: session.user.email },
          ],
        },
        select: {
          id: true,
          email: true,
        },
      });

      if (!existingUser) {
        return { type: 'NOT_FOUND' } as const;
      }

      const updatedUser = await client.user.update({
        where: { id: existingUser.id },
        data: {
          name,
          phone,
          birthday: date,
          ...(discord !== undefined ? { discord } : {}),
        },
        select: {
          id: true,
          name: true,
          phone: true,
          birthday: true,
          discord: true,
          email: true,
        },
      });

      let updatedPartner = null;
      const hasPartnerData =
        typeof customerMessage === 'string' ||
        Array.isArray(games) ||
        typeof data.halfHourlyRate === 'number' ||
        typeof coverImage === 'string' ||
        Array.isArray(coverImages);

      if (hasPartnerData) {
        const partner = await client.partner.findUnique({ 
          where: { userId: existingUser.id },
          select: {
            id: true,
            userId: true,
            images: true,
          },
        });

        if (partner) {
          const partnerUpdateData: Record<string, unknown> = {};
          if (typeof customerMessage === 'string') partnerUpdateData.customerMessage = customerMessage;
          if (Array.isArray(games)) partnerUpdateData.games = games;
          if (typeof data.halfHourlyRate === 'number') partnerUpdateData.halfHourlyRate = data.halfHourlyRate;
          if (typeof data.supportsChatOnly === 'boolean') partnerUpdateData.supportsChatOnly = data.supportsChatOnly;
          if (typeof data.chatOnlyRate === 'number') partnerUpdateData.chatOnlyRate = data.chatOnlyRate;
          if (name) partnerUpdateData.name = name;

          if (Array.isArray(coverImages) && coverImages.length > 0) {
            const imagesToSave = coverImages.slice(0, 3);
            partnerUpdateData.images = imagesToSave;
            partnerUpdateData.coverImage = imagesToSave[0] || coverImage || '';
          } else if (typeof coverImage === 'string') {
            partnerUpdateData.coverImage = coverImage;
            if (!partner.images || partner.images.length === 0) {
              partnerUpdateData.images = [coverImage];
            }
          }

          if (Object.keys(partnerUpdateData).length > 0) {
            updatedPartner = await client.partner.update({
              where: { userId: existingUser.id },
              data: partnerUpdateData,
              select: {
                id: true,
                userId: true,
                name: true,
                customerMessage: true,
                games: true,
                coverImage: true,
                images: true,
                halfHourlyRate: true,
                supportsChatOnly: true,
                chatOnlyRate: true,
              },
            });
          }
        } else if (
          (typeof customerMessage === 'string' && customerMessage.trim()) ||
          typeof coverImage === 'string' ||
          (Array.isArray(coverImages) && coverImages.length > 0)
        ) {
          const imagesToSave = Array.isArray(coverImages) && coverImages.length > 0 ? coverImages.slice(0, 3) : coverImage ? [coverImage] : [];

          updatedPartner = await client.partner.create({
            data: {
              userId: existingUser.id,
              name,
              birthday: date,
              phone,
              coverImage: imagesToSave[0] || coverImage || '',
              images: imagesToSave,
              customerMessage: customerMessage || '',
              games: [],
              halfHourlyRate: 0,
            },
            select: {
              id: true,
              userId: true,
              name: true,
              customerMessage: true,
              games: true,
              coverImage: true,
              images: true,
              halfHourlyRate: true,
            },
          });
        }
      }

      return { type: 'SUCCESS', user: updatedUser, partner: updatedPartner } as const;
    }, 'user:profile:update');

    if (result.type === 'NOT_FOUND') {
      return NextResponse.json({ error: '找不到使用者' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user: result.user, partner: result.partner });
  } catch (error: any) {
    return createErrorResponse(error, 'user:profile:update');
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }

  try {
    const user = await db.query(async (client) => {
      return client.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          phone: true,
          birthday: true,
          discord: true,
          email: true,
          partner: {
            select: {
              id: true,
              userId: true,
              name: true,
              customerMessage: true,
              games: true,
              coverImage: true,
              images: true,
              halfHourlyRate: true,
              supportsChatOnly: true,
              chatOnlyRate: true,
            },
          },
        },
      });
    }, 'user:profile:get');

    if (!user) {
      return NextResponse.json({ error: '請重新登入' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('connect')) {
      return NextResponse.json({ error: '資料庫連接失敗，請稍後再試' }, { status: 503 });
    }

    return createErrorResponse(error, 'user:profile:get');
  }
} 