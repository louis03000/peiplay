import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    })

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    return NextResponse.json({
      rankBoosterImages: partner.rankBoosterImages || []
    })

  } catch (error) {
    console.error('獲取段位證明圖片時發生錯誤:', error)
    return NextResponse.json({ error: '獲取段位證明圖片失敗' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 })
    }

    // 檢查是否為夥伴
    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    })

    if (!partner) {
      return NextResponse.json({ error: '您不是夥伴' }, { status: 403 })
    }

    const { images } = await request.json()

    if (!images || !Array.isArray(images)) {
      return NextResponse.json({ error: '請提供有效的圖片陣列' }, { status: 400 })
    }

    if (images.length > 5) {
      return NextResponse.json({ error: '最多只能上傳5張圖片' }, { status: 400 })
    }

    // 驗證圖片URL格式（支援 Cloudinary 和其他圖片服務）
    const imageUrlPattern = /^https?:\/\/.+/i
    for (const image of images) {
      if (typeof image !== 'string' || !imageUrlPattern.test(image)) {
        return NextResponse.json({ error: '請提供有效的圖片URL' }, { status: 400 })
      }
    }

    // 更新夥伴的段位證明圖片
    const updatedPartner = await prisma.partner.update({
      where: { id: partner.id },
      data: {
        rankBoosterImages: images
      }
    })

    return NextResponse.json({
      success: true,
      rankBoosterImages: updatedPartner.rankBoosterImages,
      message: '段位證明圖片已更新'
    })

  } catch (error) {
    console.error('更新段位證明圖片時發生錯誤:', error)
    return NextResponse.json({ error: '更新段位證明圖片失敗' }, { status: 500 })
  }
}
