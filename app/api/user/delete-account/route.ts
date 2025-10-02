import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';


export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    const { confirmationCode } = await request.json();
    
    // 驗證確認碼（這裡使用簡單的驗證，實際應用中可以更複雜）
    const expectedCode = 'delect_account';
    
    if ((confirmationCode || '').trim() !== expectedCode) {
      return NextResponse.json({ error: '確認碼錯誤' }, { status: 400 });
    }

    const userEmail = session.user.email;

    // 先獲取用戶資料
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
      include: {
        customer: true,
        partner: true,
        reviewsGiven: true,
        reviewsReceived: true
      }
    });

    if (!user) {
      return NextResponse.json({ error: '用戶不存在' }, { status: 404 });
    }

    // 開始資料庫交易，確保所有相關資料都被刪除
    await prisma.$transaction(async (tx) => {
      // 1. 刪除所有相關的評價記錄
      await tx.review.deleteMany({
        where: {
          OR: [
            { reviewerId: user.id },
            { revieweeId: user.id }
          ]
        }
      });

      // 2. 刪除所有相關的訂單記錄（通過 customer 關聯）
      if (user.customer) {
        await tx.order.deleteMany({
          where: {
            customerId: user.customer.id
          }
        });
      }

      // 3. 刪除所有相關的預約記錄（通過 customer 關聯）
      if (user.customer) {
        await tx.booking.deleteMany({
          where: {
            customerId: user.customer.id
          }
        });
      }

      // 4. 刪除所有相關的排程記錄（通過 partner 關聯）
      if (user.partner) {
        await tx.schedule.deleteMany({
          where: {
            partnerId: user.partner.id
          }
        });
      }

      // 5. 刪除夥伴資料（如果存在）
      if (user.partner) {
        await tx.partner.delete({
          where: {
            id: user.partner.id
          }
        });
      }

      // 6. 刪除客戶資料（如果存在）
      if (user.customer) {
        await tx.customer.delete({
          where: {
            id: user.customer.id
          }
        });
      }

      // 7. 刪除用戶資料
      await tx.user.delete({
        where: {
          id: user.id
        }
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: '帳號已成功註銷，所有資料已完全移除' 
    });

  } catch (error) {
    console.error('註銷帳號時發生錯誤:', error);
    console.error('錯誤詳情:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : 'Unknown'
    });
    return NextResponse.json({ 
      error: '註銷帳號時發生錯誤，請稍後再試',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 