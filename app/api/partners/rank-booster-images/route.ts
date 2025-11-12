import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      return { type: 'SUCCESS', images: partner.rankBoosterImages || [] } as const
    }, 'partners:rank-booster-images:get')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    return NextResponse.json({ rankBoosterImages: result.images })
  } catch (error) {
    return createErrorResponse(error, 'partners:rank-booster-images:get')
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    const body = await request.json()
    const { images } = body

    if (!images || !Array.isArray(images)) {
      return NextResponse.json({ error: '請提供有效的圖片陣列' }, { status: 400 })
    }

    if (images.length > 5) {
      return NextResponse.json({ error: '最多只能上傳5張圖片' }, { status: 400 })
    }

    const imageUrlPattern = /^https?:\/\/.+/i
    for (const image of images) {
      if (typeof image !== 'string' || !imageUrlPattern.test(image)) {
        return NextResponse.json({
          error: '請提供有效的圖片URL',
          details: `無效的圖片URL: ${image}`,
        }, { status: 400 })
      }
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      const updatedPartner = await client.partner.update({
        where: { id: partner.id },
        data: { rankBoosterImages: images },
      })

      return { type: 'SUCCESS', images: updatedPartner.rankBoosterImages } as const
    }, 'partners:rank-booster-images:update')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      rankBoosterImages: result.images || [],
      message: '段位證明圖片已更新',
    })
  } catch (error) {
    return createErrorResponse(error, 'partners:rank-booster-images:update')
  }
}
