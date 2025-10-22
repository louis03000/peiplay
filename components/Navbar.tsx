'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useState, useRef } from 'react'

export default function Navbar() {
  const { data: session, status } = useSession()
  const [hasPartner, setHasPartner] = useState(false)
  const [isPartner, setIsPartner] = useState(false)
  const [partnerLoading, setPartnerLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (session?.user?.id && status === 'authenticated') {
      setPartnerLoading(true)
      
      const checkPartnerStatus = async (retryCount = 0) => {
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
          } else if (res.status === 503 && retryCount < 2) {
            // 如果是資料庫連接錯誤，等待後重試
            console.warn(`夥伴狀態檢查失敗 (${res.status})，${retryCount + 1}秒後重試...`)
            setTimeout(() => {
              checkPartnerStatus(retryCount + 1)
            }, (retryCount + 1) * 1000)
            return
          } else {
            console.warn('夥伴狀態檢查失敗:', res.status)
            setHasPartner(false)
            setIsPartner(false)
          }
        } catch (error) {
          console.error('檢查夥伴狀態失敗:', error)
          if (retryCount < 2) {
            console.warn(`${retryCount + 1}秒後重試...`)
            setTimeout(() => {
              checkPartnerStatus(retryCount + 1)
            }, (retryCount + 1) * 1000)
            return
          }
          setHasPartner(false)
          setIsPartner(false)
        } finally {
          if (retryCount >= 2) {
            setPartnerLoading(false)
          }
        }
      }
      
      checkPartnerStatus()
    } else {
      setHasPartner(false)
      setIsPartner(false)
      setPartnerLoading(false)
    }
  }, [session, status])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [menuRef])

  return (
    <nav className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 py-4">
        <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          <Link href="/">PeiPlay</Link>
        </div>
        <div className="flex gap-2 sm:gap-4 md:gap-8 items-center text-gray-700">
          <Link href="/booking" className="hover:text-blue-600 transition-colors text-sm sm:text-base font-medium">預約</Link>
          <Link href="/ranking" className="hover:text-blue-600 transition-colors text-sm sm:text-base font-medium">排行榜</Link>
          <Link href="/partners" className="hover:text-blue-600 transition-colors text-sm sm:text-base font-medium">搜尋</Link>
          {!isPartner && <Link href="/join" className="hover:text-blue-600 transition-colors text-sm sm:text-base hidden sm:inline font-medium">加入我們</Link>}
          
          <div className="relative" ref={menuRef}>
            {session?.user ? (
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center text-sm sm:text-lg font-bold text-white border-2 border-transparent hover:border-blue-400 transition-all shadow-lg">
                {session.user.name?.charAt(0) || session.user.email?.charAt(0)}
              </button>
            ) : (
              <Link href="/auth/login" className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-colors font-semibold text-sm sm:text-base text-white shadow-lg">登入</Link>
            )}

            {menuOpen && session?.user && (
              <div className="absolute right-0 md:left-1/2 md:-translate-x-1/2 mt-3 w-48 sm:w-56 bg-white rounded-xl shadow-xl py-2 border border-gray-200">
                <div className="px-3 sm:px-4 py-3 border-b border-gray-200 text-center">
                  <p className="text-xs sm:text-sm text-gray-500">Signed in as</p>
                  <p className="font-semibold truncate text-gray-900 text-sm sm:text-base">{session.user.name || session.user.email}</p>
                </div>
                
                {/* 管理員功能 */}
                  {session?.user?.role === 'ADMIN' && (
                  <div className="mt-2">
                    <Link href="/admin/partners" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-center">
                      🔧 夥伴審核
                    </Link>
                    <Link href="/admin/reviews" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-center">
                      📝 評價審核
                    </Link>
                  </div>
                  )}
                
                {/* 夥伴功能 */}
                {partnerLoading ? (
                  <div className="mt-2">
                    <div className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-500 text-center">
                      🔄 載入中...
                    </div>
                  </div>
                ) : isPartner && (
                  <div className="mt-2">
                    <Link href="/partner/schedule" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-center">
                      📅 時段管理
                    </Link>
                  </div>
                )}
                
                {/* 預約管理 - 所有用戶都可以訪問 */}
                <div className="mt-2">
                  <Link href="/bookings" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-center">
                    📋 預約管理
                  </Link>
                </div>
                
                
                {/* 個人資料 */}
                <div className="mt-2">
                  <Link href="/profile" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors text-center">
                    👤 個人資料
                  </Link>
                </div>
                
                {/* 設定 */}
                <div className="mt-2">
                  <Link href="/profile/settings" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-center">
                    ⚙️ 設定
                  </Link>
                </div>
                
                {/* 管理員功能 */}
                {session?.user?.role === 'ADMIN' && (
                  <>
                    <div className="border-t border-white/40 mt-2 pt-2">
                      <div className="px-3 sm:px-4 py-1 text-xs text-gray-500 font-medium">管理員功能</div>
                    </div>
                    <div className="mt-2">
                      <Link href="/admin/verify-users" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-center">
                        ✅ 用戶驗證管理
                      </Link>
                    </div>
                    <div className="mt-2">
                      <Link href="/admin/security" className="block w-full px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-900 hover:text-indigo-600 hover:bg-indigo-50 transition-colors text-center">
                        🔒 安全監控
                      </Link>
                    </div>
                  </>
                )}
                
                <div className="border-t border-white/40 mt-2">
                  <button 
                    onClick={() => signOut()} 
                    className="block w-full px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors text-center"
                  >
                    登出
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
} 