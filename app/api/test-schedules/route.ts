import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登入' }, { status: 401 })
    }
    
    const partner = await prisma.partner.findUnique({ where: { userId: session.user.id } })
    if (!partner) return NextResponse.json({ error: '不是夥伴' }, { status: 403 })

    // 創建接下來7天每天 00:00-00:30 的時段
    const today = new Date()
    const testSchedules = []
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      
      const startTime = new Date(date)
      startTime.setHours(0, 0, 0, 0)
      
      const endTime = new Date(date)
      endTime.setHours(0, 30, 0, 0)
      
      testSchedules.push({
        partnerId: partner.id,
        date: startTime,
        startTime: startTime,
        endTime: endTime,
        isAvailable: true,
      })
    }
    
    // 先刪除現有的測試時段
    await prisma.schedule.deleteMany({
      where: {
        partnerId: partner.id,
        startTime: {
          gte: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
        }
      }
    })
    
    // 創建新的測試時段
    const result = await prisma.schedule.createMany({
      data: testSchedules,
      skipDuplicates: true,
    })
    
    return NextResponse.json({ success: true, count: result.count })
  } catch (error) {
    console.error('Error creating test schedules:', error)
    return NextResponse.json({ error: '創建測試時段失敗' }, { status: 500 })
  }
}
