import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { inviteCode } = await request.json()

    if (!inviteCode) {
      return NextResponse.json({ error: '請輸入邀請碼' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const inviter = await client.partner.findFirst({
        where: {
          inviteCode,
          status: 'APPROVED',
        },
        include: { user: true },
      })

      if (!inviter) {
        return { type: 'INVALID_CODE' } as const
      }

      const session = await getServerSession(authOptions)

      if (session?.user?.id) {
        const currentPartner = await client.partner.findUnique({
          where: { userId: session.user.id },
        })

        if (currentPartner && currentPartner.id === inviter.id) {
          return { type: 'SELF_INVITE' } as const
        }
      }

      return {
        type: 'SUCCESS',
        inviter: {
          id: inviter.id,
          name: inviter.name,
          inviteCode: inviter.inviteCode,
        },
      } as const
    }, 'partners:referral:validate-code')

    switch (result.type) {
      case 'INVALID_CODE':
        return NextResponse.json({ error: '無效的邀請碼' }, { status: 404 })
      case 'SELF_INVITE':
        return NextResponse.json({ error: '不能使用自己的邀請碼' }, { status: 400 })
      case 'SUCCESS':
        return NextResponse.json({ valid: true, inviter: result.inviter })
      default:
        return NextResponse.json({ error: '未知錯誤' }, { status: 500 })
    }
  } catch (error) {
    return createErrorResponse(error, 'partners:referral:validate-code')
  }
}

