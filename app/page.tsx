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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6">
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                PeiPlay
              </span>
            </h1>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-4">
              高品質遊戲陪玩平台
            </h2>
            <p className="text-lg md:text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              專業遊戲夥伴，安全預約系統，為您提供最優質的遊戲體驗。
              無論您是想找人陪玩，還是成為專業陪玩夥伴，PeiPlay 都是您的最佳選擇。
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button
                onClick={() => router.push('/booking')}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                🎮 立即預約陪玩
              </button>
              <button
                onClick={() => router.push('/join')}
                className="bg-white text-purple-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                💼 成為陪玩夥伴
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white mb-1">500+</div>
                <div className="text-sm text-gray-300">活躍夥伴</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white mb-1">10,000+</div>
                <div className="text-sm text-gray-300">成功預約</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white mb-1">4.9⭐</div>
                <div className="text-sm text-gray-300">用戶評價</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-white mb-1">24/7</div>
                <div className="text-sm text-gray-300">客服支援</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              為什麼選擇 PeiPlay？
            </h3>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              我們提供最安全、最專業的遊戲陪玩服務，讓您的遊戲體驗更加精彩
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <div className="text-4xl mb-4">🛡️</div>
              <h4 className="text-xl font-bold text-white mb-3">安全保障</h4>
              <p className="text-gray-300">
                嚴格的夥伴審核機制，安全的支付系統，讓您安心享受遊戲時光
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <div className="text-4xl mb-4">⭐</div>
              <h4 className="text-xl font-bold text-white mb-3">高品質服務</h4>
              <p className="text-gray-300">
                專業遊戲夥伴，豐富經驗，為您提供最優質的陪玩體驗
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h4 className="text-xl font-bold text-white mb-3">客製化體驗</h4>
              <p className="text-gray-300">
                根據您的需求匹配最適合的夥伴，提供個人化的遊戲服務
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              如何使用 PeiPlay？
            </h3>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              簡單三步驟，立即開始您的遊戲陪玩體驗
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-full w-16 h-16 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                1
              </div>
              <h4 className="text-xl font-bold text-white mb-3">選擇夥伴</h4>
              <p className="text-gray-300">
                瀏覽我們的專業遊戲夥伴，根據遊戲類型、評價和價格選擇最適合的夥伴
              </p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-full w-16 h-16 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                2
              </div>
              <h4 className="text-xl font-bold text-white mb-3">預約時間</h4>
              <p className="text-gray-300">
                選擇您方便的時間，系統會自動創建 Discord 頻道讓您與夥伴溝通
              </p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-full w-16 h-16 flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
                3
              </div>
              <h4 className="text-xl font-bold text-white mb-3">開始遊戲</h4>
              <p className="text-gray-300">
                在預約時間進入語音頻道，與夥伴一起享受精彩的遊戲時光
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="py-16 bg-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              用戶見證
            </h3>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              看看其他用戶對 PeiPlay 的評價
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
              <p className="text-gray-300 mb-4">
                "PeiPlay 的夥伴非常專業，遊戲技術很好，溝通也很順暢。預約系統很方便，推薦給所有遊戲玩家！"
              </p>
              <div className="text-white font-semibold">- 張同學</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
              <p className="text-gray-300 mb-4">
                "成為 PeiPlay 的夥伴後，收入穩定，平台管理也很完善。客戶素質都很高，工作體驗很棒！"
              </p>
              <div className="text-white font-semibold">- 李夥伴</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6">
              <div className="flex items-center mb-4">
                <div className="flex text-yellow-400">
                  ⭐⭐⭐⭐⭐
                </div>
              </div>
              <p className="text-gray-300 mb-4">
                "安全可靠的平台，支付系統很完善。客服回應快速，有任何問題都能得到及時解決。"
              </p>
              <div className="text-white font-semibold">- 王先生</div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
            準備開始您的遊戲之旅了嗎？
          </h3>
          <p className="text-lg text-gray-300 mb-8">
            立即加入 PeiPlay，體驗最專業的遊戲陪玩服務
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/booking')}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              🎮 立即預約
            </button>
            <button
              onClick={() => router.push('/join')}
              className="bg-white text-purple-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              💼 成為夥伴
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">PeiPlay</h3>
              <p className="text-gray-400 text-sm">
                專業遊戲陪玩平台，為您提供最優質的遊戲體驗。
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">服務</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/booking" className="hover:text-white">預約陪玩</a></li>
                <li><a href="/join" className="hover:text-white">成為夥伴</a></li>
                <li><a href="/partners" className="hover:text-white">夥伴列表</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">支援</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">常見問題</a></li>
                <li><a href="#" className="hover:text-white">使用指南</a></li>
                <li><a href="#" className="hover:text-white">聯絡客服</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">聯絡我們</h4>
              <div className="space-y-2 text-sm text-gray-400">
            <div>客服Line：@484mkuzi</div>
            <div>客服信箱：peiplay987@gmail.com</div>
            <div>客服電話：0953868520</div>
            <div>客服時間：週一～週日 24 小時</div>
            <div>公司統一編號：95367956</div>
            <div>營業人名稱：昇褀科技</div>
          </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 PeiPlay. All rights reserved. 需要幫助請聯絡我們，我們將竭誠為您服務。</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
