import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export async function POST() {
  try {
    const result = await db.query(async (client) => {
      const existingAdmin = await client.user.findFirst({
        where: { role: 'ADMIN' },
      })

      if (existingAdmin) {
        return {
          type: 'EXISTS',
          admin: existingAdmin,
        } as const
      }

      const hashedPassword = await bcrypt.hash('admin123', 10)

      const admin = await client.user.create({
        data: {
          email: 'admin@peiplay.com',
          password: hashedPassword,
          name: '管理員',
          role: 'ADMIN',
          phone: '0900000000',
          birthday: new Date('1990-01-01'),
        },
      })

      return { type: 'CREATED', admin } as const
    }, 'admin:create-admin')

    if (result.type === 'EXISTS') {
      return NextResponse.json({
        message: '管理員已存在',
        admin: {
          email: result.admin.email,
          name: result.admin.name,
        },
      })
    }

    return NextResponse.json({
      message: '管理員創建成功',
      admin: {
        email: result.admin.email,
        name: result.admin.name,
        password: 'admin123',
      },
    })
  } catch (error) {
    return createErrorResponse(error, 'admin:create-admin')
  }
} 