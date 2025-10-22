'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Review {
  id: string
  rating: number
  comment: string
  createdAt: string
  reviewerName: string
}

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
  const [isPartner, setIsPartner] = useState(false)
  const [hasPartner, setHasPartner] = useState(false)

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
      
      // 檢查夥伴狀態
      const checkPartnerStatus = async () => {
        try {
          const res = await fetch('/api/partners/self')
          if (res.ok) {
            const data = await res.json()
            if (data && data.partner) {
              setHasPartner(data.partner.status === 'APPROVED')
              setIsPartner(true)
            } else {
              setHasPartner(false)
              setIsPartner(false)
            }
          } else {
            setHasPartner(false)
            setIsPartner(false)
          }
        } catch (error) {
          console.error('檢查夥伴狀態失敗:', error)
          setHasPartner(false)
          setIsPartner(false)
        }
      }
      
      checkUserProfile()
      checkPartnerStatus()
    } else {
      setHasPartner(false)
      setIsPartner(false)
    }
  }, [session, status, router])

  // 獲取真實用戶評價
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch('/api/reviews/public')
        if (response.ok) {
          const data = await response.json()
          setReviews(data.reviews || [])
        }
      } catch (error) {
        console.error('Failed to fetch reviews:', error)
      }
    }
    
    fetchReviews()
  }, [])

  return (
    <div className="snap-y snap-mandatory overflow-y-scroll h-screen">
      {/* Hero Section - 第一屏 */}
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 snap-start">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                PeiPlay
              </span>
            </h1>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800 mb-4">
              高品質遊戲陪玩平台
            </h2>
            <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              專業遊戲夥伴，安全預約系統，為您提供最優質的遊戲體驗。
              無論您是想找人陪玩，還是成為專業陪玩夥伴，PeiPlay 都是您的最佳選擇。
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => router.push('/booking')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                🎮 立即預約陪玩
              </button>
              {!isPartner && (
                <button
                  onClick={() => router.push('/join')}
                  className="bg-white text-blue-600 hover:bg-blue-50 border-2 border-blue-600 font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  💼 成為陪玩夥伴
                </button>
              )}
              {isPartner && (
                <button
                  onClick={() => router.push('/partner/schedule')}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  🎯 夥伴管理
                </button>
              )}
            </div>

          </div>
        </div>
      </div>


      {/* How It Works Section - 第二屏 */}
      <div className="h-screen flex items-center justify-center bg-white snap-start">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              如何使用 PeiPlay？
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              簡單三步驟，立即開始您的遊戲陪玩體驗
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full w-20 h-20 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6 shadow-lg">
                1
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-4">選擇夥伴</h4>
              <p className="text-gray-600 text-lg">
                瀏覽我們的專業遊戲夥伴，根據遊戲類型、評價和價格選擇最適合的夥伴
              </p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full w-20 h-20 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6 shadow-lg">
                2
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-4">預約時間</h4>
              <p className="text-gray-600 text-lg">
                選擇您方便的時間，系統會自動創建 Discord 頻道讓您與夥伴溝通
              </p>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full w-20 h-20 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6 shadow-lg">
                3
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-4">開始遊戲</h4>
              <p className="text-gray-600 text-lg">
                在預約時間進入語音頻道，與夥伴一起享受精彩的遊戲時光
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials Section - 第三屏 */}
      <div className="h-screen flex items-center justify-center bg-gradient-to-r from-blue-50 to-indigo-50 snap-start">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              用戶見證
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              看看其他用戶對 PeiPlay 的真實評價
            </p>
          </div>

          {reviews.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-8">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-xl p-8 shadow-lg border border-gray-200">
                  <div className="flex items-center mb-6">
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={i < review.rating ? 'text-yellow-400' : 'text-gray-300'}>
                          ⭐
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-700 mb-6 text-lg">
                    "{review.comment}"
                  </p>
                  <div className="text-gray-900 font-semibold text-lg">- {review.reviewerName}</div>
                  <div className="text-sm text-gray-500 mt-2">
                    {new Date(review.createdAt).toLocaleDateString('zh-TW')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-6xl mb-8">💬</div>
              <p className="text-gray-600 text-xl mb-8">
                目前還沒有用戶評價，成為第一個分享體驗的人吧！
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => router.push('/booking')}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  🎮 立即體驗
                </button>
                {!isPartner && (
                  <button
                    onClick={() => router.push('/join')}
                    className="bg-white text-blue-600 hover:bg-blue-50 border-2 border-blue-600 font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    💼 成為夥伴
                  </button>
                )}
                {isPartner && (
                  <button
                    onClick={() => router.push('/partner/schedule')}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    🎯 夥伴管理
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Final CTA Section - 第四屏 */}
      <div className="h-screen flex items-center justify-center bg-white snap-start">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-6xl mb-8">🚀</div>
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            準備開始您的遊戲之旅了嗎？
          </h3>
          <p className="text-lg text-gray-600 mb-8">
            立即加入 PeiPlay，體驗最專業的遊戲陪玩服務
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/booking')}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              🎮 立即預約
            </button>
            {!isPartner && (
              <button
                onClick={() => router.push('/join')}
                className="bg-white text-blue-600 hover:bg-blue-50 border-2 border-blue-600 font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                💼 成為夥伴
              </button>
            )}
            {isPartner && (
              <button
                onClick={() => router.push('/partner/schedule')}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg transform hover:scale-105 transition-all duration-200"
              >
                🎯 夥伴管理
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
