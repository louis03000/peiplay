import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';


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

    // 嚴格 birthday 格式轉換
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

    // 先查 user 是否存在（id 或 email 其一即可）
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: session.user.id },
          { email: session.user.email }
        ]
      },
    });
    if (!existingUser) {
      return NextResponse.json({ error: '找不到使用者' }, { status: 404 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name,
        phone,
        birthday: date,
        ...(discord !== undefined ? { discord } : {}),
      },
    });

    // 處理 partner 相關資料更新
    let updatedPartner = null;
    const hasPartnerData = typeof customerMessage === 'string' || 
      Array.isArray(games) || 
      typeof data.halfHourlyRate === 'number' || 
      name || 
      typeof coverImage === 'string' || 
      Array.isArray(coverImages);
      
    if (hasPartnerData) {
      // 先查 partner
      const partner = await prisma.partner.findUnique({ where: { userId: existingUser.id } });
      
      if (partner) {
        // 如果用戶是 partner，更新 partner 資料
        const partnerUpdateData: any = {};
        if (typeof customerMessage === 'string') partnerUpdateData.customerMessage = customerMessage;
        if (Array.isArray(games)) partnerUpdateData.games = games;
        if (typeof data.halfHourlyRate === 'number') partnerUpdateData.halfHourlyRate = data.halfHourlyRate;
        if (name) partnerUpdateData.name = name; // 同步更新夥伴表的姓名
        
        // 處理封面照：如果有 coverImages 陣列，使用它；否則使用 coverImage
        if (Array.isArray(coverImages) && coverImages.length > 0) {
          // 最多保存3張
          const imagesToSave = coverImages.slice(0, 3);
          partnerUpdateData.images = imagesToSave;
          partnerUpdateData.coverImage = imagesToSave[0] || coverImage || ''; // 第一張作為 coverImage
        } else if (typeof coverImage === 'string') {
          partnerUpdateData.coverImage = coverImage;
          // 如果 coverImage 存在但 images 陣列為空，將其加入 images
          if (!partner.images || partner.images.length === 0) {
            partnerUpdateData.images = [coverImage];
          }
        }
        
        if (Object.keys(partnerUpdateData).length > 0) {
          updatedPartner = await prisma.partner.update({
            where: { userId: existingUser.id },
            data: partnerUpdateData
          });
        }
      } else if ((typeof customerMessage === 'string' && customerMessage.trim()) || 
                 typeof coverImage === 'string' || 
                 (Array.isArray(coverImages) && coverImages.length > 0)) {
        // 如果用戶不是 partner 但有留言板內容或封面照，創建 partner 記錄
        const imagesToSave = Array.isArray(coverImages) && coverImages.length > 0 
          ? coverImages.slice(0, 3)
          : (coverImage ? [coverImage] : []);
        
        updatedPartner = await prisma.partner.create({
          data: {
            userId: existingUser.id,
            name: name,
            birthday: date, // 使用用戶的生日
            phone: phone, // 使用用戶的電話
            coverImage: imagesToSave[0] || coverImage || '', // 第一張作為 coverImage
            images: imagesToSave, // 保存圖片陣列
            customerMessage: customerMessage || '',
            games: [],
            halfHourlyRate: 0
          }
        });
      }
    }

    return NextResponse.json({ success: true, user: updatedUser, partner: updatedPartner });
  } catch (error: any) {
    console.error('補資料 API 失敗:', JSON.stringify(error, null, 2));
    return NextResponse.json({
      error: '補資料失敗',
      detail: error?.message || '未知錯誤',
      stack: error?.stack,
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: '請先登入' }, { status: 401 });
  }
  try {
    // 測試資料庫連接
    await prisma.$connect()
    
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        phone: true,
        birthday: true,
        discord: true,
        email: true,
        partner: true
      },
    });
    if (!user) {
      return NextResponse.json({ error: '請重新登入' }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('User profile GET error:', error)
    
    // 如果是資料庫連接錯誤，返回更友好的錯誤信息
    if (error instanceof Error && error.message.includes('connect')) {
      return NextResponse.json({ 
        error: '資料庫連接失敗，請稍後再試' 
      }, { status: 503 })
    }
    
    return NextResponse.json({ 
      error: '取得個人資料失敗', 
      detail: error?.message || '未知錯誤' 
    }, { status: 500 });
  } finally {
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('Database disconnect error:', disconnectError)
    }
  }
} 