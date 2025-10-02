import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    // 檢查是否已有用戶
    const existingUser = await prisma.user.findFirst()
    
    if (existingUser) {
      return NextResponse.json({
        message: '已有用戶存在',
        user: {
          email: existingUser.email,
          name: existingUser.name,
          role: existingUser.role
        }
      })
    }

    // 創建測試用戶
    const hashedPassword = await bcrypt.hash('test123', 10)
    
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: hashedPassword,
        name: '測試用戶',
        role: 'CUSTOMER',
        phone: '0900000000',
        birthday: new Date('1990-01-01'),
      },
    })

    return NextResponse.json({
      message: '測試用戶創建成功',
      user: {
        email: user.email,
        name: user.name,
        password: 'test123'
      }
    })
  } catch (error) {
    console.error('Error creating test user:', error)
    return NextResponse.json(
      { error: '創建測試用戶失敗', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 