import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST() {
  try {
    // 檢查是否已存在管理員
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    })

    if (existingAdmin) {
      return NextResponse.json({
        message: '管理員已存在',
        admin: {
          email: existingAdmin.email,
          name: existingAdmin.name
        }
      })
    }

    // 創建管理員用戶
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    const admin = await prisma.user.create({
      data: {
        email: 'admin@peiplay.com',
        password: hashedPassword,
        name: '管理員',
        role: 'ADMIN',
        phone: '0900000000',
        birthday: new Date('1990-01-01'),
      },
    })

    return NextResponse.json({
      message: '管理員創建成功',
      admin: {
        email: admin.email,
        name: admin.name,
        password: 'admin123' // 明文密碼，僅用於初始設置
      }
    })
  } catch (error) {
    console.error('Error creating admin:', error)
    return NextResponse.json(
      { error: '創建管理員失敗' },
      { status: 500 }
    )
  }
} 