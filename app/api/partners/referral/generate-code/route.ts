import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        include: { user: true },
      })

      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      if (partner.status !== 'APPROVED') {
        return { type: 'NOT_APPROVED' } as const
      }

      const partnerIdPrefix = partner.id.substring(0, 8).toUpperCase()
      const randomSuffix = Math.floor(1000 + Math.random() * 9000)
      const inviteCode = `${partnerIdPrefix}${randomSuffix}`

      const updatedPartner = await client.partner.update({
        where: { id: partner.id },
        data: { inviteCode },
        include: { user: true },
      })

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

    switch (result.type) {
      case 'NOT_PARTNER':
        return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
      case 'NOT_APPROVED':
        return NextResponse.json({ error: '只有已核准的夥伴才能生成邀請碼' }, { status: 403 })
      case 'SUCCESS':
        return NextResponse.json({ inviteCode: result.inviteCode, partner: result.partner })
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 })
    }
  } catch (error) {
    return createErrorResponse(error, 'partners:referral:generate-code')
  }
}

