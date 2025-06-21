'use client'
import MyBookings from '@/app/components/MyBookings'
import OrderHistory from '@/app/components/OrderHistory'

export default function ProfileClient() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8">會員中心</h1>
      <div className="space-y-8">
        <section>
          <MyBookings />
        </section>
        <section>
          <OrderHistory />
        </section>
      </div>
    </div>
  )
} 