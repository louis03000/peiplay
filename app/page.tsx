'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    // 如果用戶已登入但沒有完整資料，跳轉到 onboarding
    if (status === 'authenticated' && session?.user?.id) {
      // 檢查當前是否在 onboarding 頁面
      if (window.location.pathname === '/onboarding') {
        console.log('當前在 onboarding 頁面，跳過檢查')
        return
      }
      
      const checkUserProfile = async () => {
        try {
          const res = await fetch('/api/user/profile')
          console.log('檢查用戶資料，回應狀態:', res.status)
          
          if (res.ok) {
            const data = await res.json()
            const user = data.user
            console.log('用戶資料:', user)
            
            // 檢查是否有電話和生日
            const hasPhone = user.phone && user.phone.trim() !== ''
            const hasBirthday = user.birthday && user.birthday !== '2000-01-01'
            
            console.log('檢查結果:', { hasPhone, hasBirthday, phone: user.phone, birthday: user.birthday })
            
            // 如果用戶沒有電話或生日，視為新用戶
            if (!hasPhone || !hasBirthday) {
              console.log('新用戶，跳轉到 onboarding')
              router.push('/onboarding')
            } else {
              console.log('用戶資料完整，停留在首頁')
              // 用戶資料完整，不需要做任何跳轉，就停留在首頁
            }
          } else {
            console.error('獲取用戶資料失敗:', res.status)
          }
        } catch (error) {
          console.error('檢查用戶資料失敗:', error)
        }
      }
      
      checkUserProfile()
    }
  }, [session, status, router])

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-[#23243a] via-[#2d2e4a] to-[#1a1b2b]">
      <main className="flex-1 flex flex-col items-center justify-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white text-center">PeiPlay 預約平台</h1>
        <p className="text-lg md:text-2xl text-gray-300 mb-8 text-center">專為顧客與夥伴打造的預約與管理系統。</p>
      </main>
      <footer className="w-full bg-gray-900 text-white py-6 mt-16">
        <div className="max-w-4xl mx-auto px-4">
          <h3 className="text-lg font-bold mb-3">聯絡我們</h3>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>綠界科技股份有限公司</div>
            <div>客服信箱：test@ecpay.com.tw</div>
            <div>客服電話：02-2655-0115</div>
            <div>客服時間：週一～週日 24 小時</div>
          </div>
          <div className="text-xs text-gray-400 mt-2">本頁面僅為範例，實際聯絡資訊請依註冊綠界會員時填寫為準。</div>
        </div>
      </footer>
    </div>
  )
}
