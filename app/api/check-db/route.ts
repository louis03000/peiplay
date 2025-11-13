import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log("🔍 檢查資料庫狀態...")
    
    const result = await db.query(async (client) => {
      // 檢查用戶
      const userCount = await client.user.count()
      console.log("用戶數量:", userCount)
      
      // 檢查客戶
      const customerCount = await client.customer.count()
      console.log("客戶數量:", customerCount)
      
      // 檢查夥伴
      const partnerCount = await client.partner.count()
      console.log("夥伴數量:", partnerCount)
      
      // 檢查時段
      const scheduleCount = await client.schedule.count()
      console.log("時段數量:", scheduleCount)
      
      // 檢查預約
      const bookingCount = await client.booking.count()
      console.log("預約數量:", bookingCount)
      
      // 獲取第一個用戶
      const firstUser = await client.user.findFirst({
        select: { id: true, email: true, role: true }
      })
      
      // 獲取第一個客戶
      const firstCustomer = await client.customer.findFirst({
        select: { id: true, name: true, userId: true }
      })
      
      // 獲取第一個夥伴
      const firstPartner = await client.partner.findFirst({
        select: { id: true, name: true, userId: true }
      })
      
      return {
        counts: {
          users: userCount,
          customers: customerCount,
          partners: partnerCount,
          schedules: scheduleCount,
          bookings: bookingCount
        },
        samples: {
          firstUser,
          firstCustomer,
          firstPartner
        }
      };
    });
    
    return NextResponse.json({
      success: true,
      ...result
    })
    
  } catch (error) {
    console.error("❌ 檢查失敗:", error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
