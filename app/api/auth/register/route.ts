import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { email, password, name, birthday, phone, role, games: requestedGames, discord } = data

    // 檢查郵箱是否已被註冊
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: '此郵箱已被註冊' },
        { status: 400 }
      )
    }

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 10)

    // 創建用戶
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        birthday: new Date(birthday),
        phone,
        role: role || 'CUSTOMER',
        discord,
      },
    })

    // 如果是夥伴，創建夥伴資料
    if (role === 'PARTNER') {
      await prisma.partner.create({
        data: {
          userId: user.id,
          name,
          birthday: new Date(birthday),
          phone,
          coverImage: '',
          games: requestedGames || [],
          hourlyRate: 0, // 預設值，之後可以更新
        },
      })
    }

    return NextResponse.json({ message: '註冊成功' })
  } catch (error) {
    console.error('Error registering user:', error)
    return NextResponse.json(
      { error: '註冊失敗' },
      { status: 500 }
    )
  }
}

// 新增這段
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}