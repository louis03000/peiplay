import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const partnerId = searchParams.get('partnerId')

    if (partnerId) {
      const result = await db.query(async (client) => {
        const partner = await client.partner.findUnique({
          where: { id: partnerId },
          select: {
            id: true,
            name: true,
            referralPlatformFee: true,
            referralBonusPercentage: true,
            referralCount: true,
            totalReferralEarnings: true,
          },
        })

        if (!partner) {
          return { type: 'NOT_FOUND' } as const
        }

        return { type: 'SUCCESS', partner } as const
      }, 'admin:referral-config:get-one')

      if (result.type === 'NOT_FOUND') {
        return NextResponse.json({ error: '夥伴不存在' }, { status: 404 })
      }

      return NextResponse.json(result.partner)
    }

    const partners = await db.query(async (client) => {
      return client.partner.findMany({
        where: { status: 'APPROVED' },
        select: {
          id: true,
          name: true,
          referralPlatformFee: true,
          referralBonusPercentage: true,
          referralCount: true,
          totalReferralEarnings: true,
        },
        orderBy: { name: 'asc' },
      })
    }, 'admin:referral-config:get-all')

    return NextResponse.json(partners)
  } catch (error) {
    return createErrorResponse(error, 'admin:referral-config:get')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { partnerId, referralPlatformFee, referralBonusPercentage } = await request.json()

    if (!partnerId || referralPlatformFee === undefined || referralBonusPercentage === undefined) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 })
    }

    if (referralPlatformFee < 0 || referralPlatformFee > 100) {
      return NextResponse.json({ error: '平台抽成比例必須在 0-100% 之間' }, { status: 400 })
    }

    if (referralBonusPercentage < 0 || referralBonusPercentage > 100) {
      return NextResponse.json({ error: '推薦獎勵比例必須在 0-100% 之間' }, { status: 400 })
    }

    if (referralPlatformFee + referralBonusPercentage > 100) {
      return NextResponse.json({ error: '平台抽成 + 推薦獎勵不能超過 100%' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const updatedPartner = await client.partner.update({
        where: { id: partnerId },
        data: {
          referralPlatformFee,
          referralBonusPercentage,
        },
        select: {
          id: true,
          name: true,
          referralPlatformFee: true,
          referralBonusPercentage: true,
        },
      })

      return updatedPartner
    }, 'admin:referral-config:update')

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, 'admin:referral-config:update')
  }
}

