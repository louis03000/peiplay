import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('[推薦系統] 生成邀請碼 API 被調用');
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      console.log('[推薦系統] 未登入');
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    console.log('[推薦系統] 用戶 ID:', session.user.id);

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        include: { user: true },
      })

      if (!partner) {
        console.log('[推薦系統] 找不到夥伴記錄');
        return { type: 'NOT_PARTNER' } as const
      }

      console.log('[推薦系統] 找到夥伴:', { id: partner.id, status: partner.status });

      if (partner.status !== 'APPROVED') {
        console.log('[推薦系統] 夥伴狀態未核准:', partner.status);
        return { type: 'NOT_APPROVED' } as const
      }

      const partnerIdPrefix = partner.id.substring(0, 8).toUpperCase()
      const randomSuffix = Math.floor(1000 + Math.random() * 9000)
      const inviteCode = `${partnerIdPrefix}${randomSuffix}`
      
      console.log('[推薦系統] 生成邀請碼:', inviteCode);

      const updatedPartner = await client.partner.update({
        where: { id: partner.id },
        data: { inviteCode },
        include: { user: true },
      })
      
      console.log('[推薦系統] 邀請碼更新成功');

      return {
        type: 'SUCCESS',
        inviteCode,
        partner: {
          id: updatedPartner.id,
          name: updatedPartner.name,
          inviteCode: updatedPartner.inviteCode,
        },
      } as const
    }, 'partners:referral:generate-code')

    console.log('[推薦系統] 處理結果:', result.type);
    
    switch (result.type) {
      case 'NOT_PARTNER':
        return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
      case 'NOT_APPROVED':
        return NextResponse.json({ error: '只有已核准的夥伴才能生成邀請碼' }, { status: 403 })
      case 'SUCCESS':
        console.log('[推薦系統] 成功生成邀請碼:', result.inviteCode);
        return NextResponse.json({ inviteCode: result.inviteCode, partner: result.partner })
      default:
        console.error('[推薦系統] 未知結果類型:', result);
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 })
    }
  } catch (error) {
    console.error('[推薦系統] 生成邀請碼異常:', error);
    return createErrorResponse(error, 'partners:referral:generate-code')
  }
}

