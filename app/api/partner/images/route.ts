import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const { imageUrl } = await request.json()
    if (!imageUrl) {
      return NextResponse.json({ error: '缺少圖片 URL' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      const updated = await client.partner.update({
        where: { userId: session.user.id },
        data: { images: { push: imageUrl } },
        select: { images: true },
      })

      return { type: 'SUCCESS', images: updated.images }
    }, 'partner:images:post')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
    }

    return NextResponse.json({ success: true, images: result.images })
  } catch (error) {
    return createErrorResponse(error, 'partner:images:post')
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const { imageUrl } = await request.json()
    if (!imageUrl) {
      return NextResponse.json({ error: '缺少圖片 URL' }, { status: 400 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({ where: { userId: session.user.id } })
      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      const filtered = partner.images.filter((img) => img !== imageUrl)

      const updated = await client.partner.update({
        where: { userId: session.user.id },
        data: { images: filtered },
        select: { images: true },
      })

      return { type: 'SUCCESS', images: updated.images }
    }, 'partner:images:delete')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
    }

    return NextResponse.json({ success: true, images: result.images })
  } catch (error) {
    return createErrorResponse(error, 'partner:images:delete')
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const result = await db.query(async (client) => {
      const partner = await client.partner.findUnique({
        where: { userId: session.user.id },
        select: { images: true },
      })

      if (!partner) {
        return { type: 'NOT_PARTNER' } as const
      }

      return { type: 'SUCCESS', images: partner.images }
    }, 'partner:images:get')

    if (result.type === 'NOT_PARTNER') {
      return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
    }

    return NextResponse.json({ images: result.images })
  } catch (error) {
    return createErrorResponse(error, 'partner:images:get')
  }
} 