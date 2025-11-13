import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const { users, counts } = await db.query(async (client) => {
      const usersData = await client.user.findMany({
        include: {
          customer: true,
          partner: true,
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      const [userCount, customerCount, partnerCount, scheduleCount] = await Promise.all([
        client.user.count(),
        client.customer.count(),
        client.partner.count(),
        client.schedule.count()
      ]);

      return {
        users: usersData,
        counts: { userCount, customerCount, partnerCount, scheduleCount }
      };
    });

    return NextResponse.json({
      summary: {
        totalUsers: counts.userCount,
        totalCustomers: counts.customerCount,
        totalPartners: counts.partnerCount,
        totalSchedules: counts.scheduleCount
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