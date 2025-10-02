import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
// 上傳圖片
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    })

    if (!partner) {
      return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
    }

    const { imageUrl } = await request.json()

    if (!imageUrl) {
      return NextResponse.json({ error: '缺少圖片 URL' }, { status: 400 })
    }

    // 更新夥伴的圖片陣列
    const updatedPartner = await prisma.partner.update({
      where: { userId: session.user.id },
      data: {
        images: {
          push: imageUrl
        }
      }
    })

    return NextResponse.json({ 
      success: true, 
      images: updatedPartner.images 
    })
  } catch (error) {
    console.error('Upload image error:', error)
    return NextResponse.json({ error: '上傳圖片失敗' }, { status: 500 })
  }
}

// 刪除圖片
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

    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id }
    })

    if (!partner) {
      return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
    }

    // 從圖片陣列中移除指定圖片
    const updatedImages = partner.images.filter(img => img !== imageUrl)

    const updatedPartner = await prisma.partner.update({
      where: { userId: session.user.id },
      data: {
        images: updatedImages
      }
    })

    return NextResponse.json({ 
      success: true, 
      images: updatedPartner.images 
    })
  } catch (error) {
    console.error('Delete image error:', error)
    return NextResponse.json({ error: '刪除圖片失敗' }, { status: 500 })
  }
}

// 獲取夥伴圖片
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }

    const partner = await prisma.partner.findUnique({
      where: { userId: session.user.id },
      select: { images: true }
    })

    if (!partner) {
      return NextResponse.json({ error: '不是夥伴' }, { status: 403 })
    }

    return NextResponse.json({ images: partner.images })
  } catch (error) {
    console.error('Get images error:', error)
    return NextResponse.json({ error: '獲取圖片失敗' }, { status: 500 })
  }
} 