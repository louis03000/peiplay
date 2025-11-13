import { NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log("🔍 Debug group bookings API triggered");
    
    // 查詢所有群組預約
    const { allGroupBookings, activeGroupBookings } = await db.query(async (client) => {
      const all = await client.groupBooking.findMany({
        include: {
          GroupBookingParticipant: {
            include: {
              Partner: {
                include: {
                  user: true
                }
              },
              Customer: {
                include: {
                  user: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // 查詢 ACTIVE 狀態的群組預約
      const active = await client.groupBooking.findMany({
        where: { status: 'ACTIVE' },
        include: {
          GroupBookingParticipant: {
            include: {
              Partner: {
                include: {
                  user: true
                }
              },
              Customer: {
                include: {
                  user: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return { allGroupBookings: all, activeGroupBookings: active };
    });

    console.log("📊 Debug results:", {
      totalGroupBookings: allGroupBookings.length,
      activeGroupBookings: activeGroupBookings.length
    });

    return NextResponse.json({
      success: true,
      totalGroupBookings: allGroupBookings.length,
      activeGroupBookings: activeGroupBookings.length,
      allGroupBookings: allGroupBookings.map(group => ({
        id: group.id,
        title: group.title,
        status: group.status,
        initiatorId: group.initiatorId,
        initiatorType: group.initiatorType,
        participants: group.GroupBookingParticipant.length,
        createdAt: group.createdAt
      })),
      activeGroupBookingsList: activeGroupBookings.map(group => ({
        id: group.id,
        title: group.title,
        status: group.status,
        initiatorId: group.initiatorId,
        initiatorType: group.initiatorType,
        participants: group.GroupBookingParticipant.length,
        createdAt: group.createdAt
      }))
    });

  } catch (error) {
    console.error("❌ Debug group bookings failed:", error);
    return NextResponse.json({ 
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
