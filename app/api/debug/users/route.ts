import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        customer: true,
        partner: true,
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    const userCount = await prisma.user.count()
    const customerCount = await prisma.customer.count()
    const partnerCount = await prisma.partner.count()
    const scheduleCount = await prisma.schedule.count()

    return NextResponse.json({
      summary: {
        totalUsers: userCount,
        totalCustomers: customerCount,
        totalPartners: partnerCount,
        totalSchedules: scheduleCount
      },
      users: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        birthday: user.birthday,
        hasCustomer: !!user.customer,
        hasPartner: !!user.partner,
        createdAt: user.createdAt
      }))
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: '查詢用戶失敗', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 