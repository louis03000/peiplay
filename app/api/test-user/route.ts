import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import bcrypt from 'bcryptjs'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    // 檢查是否已有用戶並創建測試用戶
    const user = await db.query(async (client) => {
      const existingUser = await client.user.findFirst()
      
      if (existingUser) {
        throw new Error('EXISTING_USER')
      }

      // 創建測試用戶
      const hashedPassword = await bcrypt.hash('test123', 10)
      
      return await client.user.create({
        data: {
          email: 'test@example.com',
          password: hashedPassword,
          name: '測試用戶',
          role: 'CUSTOMER',
          phone: '0900000000',
          birthday: new Date('1990-01-01'),
        },
      })
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
    if (error instanceof Error && error.message === 'EXISTING_USER') {
      const existingUser = await db.query(async (client) => {
        return await client.user.findFirst()
      })
      return NextResponse.json({
        message: '已有用戶存在',
        user: {
          email: existingUser?.email,
          name: existingUser?.name,
          role: existingUser?.role
        }
      })
    }
    return NextResponse.json(
      { error: '創建測試用戶失敗', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 