'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'

export default function Navigation() {
  const { data: session, status } = useSession()
  const [hasPartner, setHasPartner] = useState(false)
  const [isPartner, setIsPartner] = useState(false)
  const [partnerLoading, setPartnerLoading] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // 檢查夥伴狀態 - 優化版本：使用緩存避免每次載入
  useEffect(() => {
    if (session?.user?.id && status === 'authenticated') {
      // 清除可能過時的緩存，強制重新檢查
      if (typeof window !== 'undefined') {
        // 檢查緩存是否過期（超過5分鐘）
        const cachedTimestamp = sessionStorage.getItem(`partner_status_timestamp_${session.user.id}`)
        if (cachedTimestamp) {
          const cacheAge = Date.now() - parseInt(cachedTimestamp)
          if (cacheAge > 5 * 60 * 1000) {
            // 緩存過期，清除它
            sessionStorage.removeItem(`partner_status_${session.user.id}`)
            sessionStorage.removeItem(`partner_status_timestamp_${session.user.id}`)
          }
        }
      }

      // 先檢查本地緩存
      const cachedPartnerStatus = typeof window !== 'undefined' 
        ? sessionStorage.getItem(`partner_status_${session.user.id}`)
        : null
      const cachedTimestamp = typeof window !== 'undefined'
        ? sessionStorage.getItem(`partner_status_timestamp_${session.user.id}`)
        : null
      
      // 如果緩存存在且未過期（5分鐘內），直接使用
      if (cachedPartnerStatus && cachedTimestamp && cachedPartnerStatus !== 'NONE') {
        const cacheAge = Date.now() - parseInt(cachedTimestamp)
        if (cacheAge < 5 * 60 * 1000) { // 5分鐘內有效
          const isApproved = cachedPartnerStatus === 'APPROVED'
          setHasPartner(isApproved)
          setIsPartner(true)
          setPartnerLoading(false)
          
          // 在背景更新，不阻塞 UI
          checkPartnerStatusBackground()
          return
        }
      }
      
      setPartnerLoading(true)
      checkPartnerStatus()
    } else {
      setHasPartner(false)
      setIsPartner(false)
      setPartnerLoading(false)
      // 清除緩存（用戶登出時）
      if (typeof window !== 'undefined' && session?.user?.id) {
        sessionStorage.removeItem(`partner_status_${session.user.id}`)
        sessionStorage.removeItem(`partner_status_timestamp_${session.user.id}`)
      }
    }
    
    // 快速檢查夥伴狀態
    async function checkPartnerStatus() {
      try {
        const res = await fetch('/api/partners/self', {
          cache: 'no-store', // 禁用緩存，確保獲取最新數據
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        
        if (res.ok) {
          const data = await res.json()
          const hasPartner = !!data?.partner
          const isApproved = data?.partner?.status === 'APPROVED'
          
          setHasPartner(isApproved)
          setIsPartner(hasPartner)
          setPartnerLoading(false)
          
          // 緩存結果
          if (typeof window !== 'undefined') {
            if (hasPartner) {
              sessionStorage.setItem(`partner_status_${session?.user?.id}`, data.partner.status || '')
              sessionStorage.setItem(`partner_status_timestamp_${session?.user?.id}`, Date.now().toString())
            } else {
              // 如果沒有夥伴，也緩存這個結果（但時間較短，30秒）
              sessionStorage.setItem(`partner_status_${session?.user?.id}`, 'NONE')
              sessionStorage.setItem(`partner_status_timestamp_${session?.user?.id}`, Date.now().toString())
            }
          }
        } else {
          console.warn('夥伴狀態檢查失敗:', res.status)
          // API 失敗時，不清除緩存，保持當前狀態，避免UI閃爍
          // 但設置載入完成，避免一直顯示載入中
          setPartnerLoading(false)
          // 如果沒有緩存，才設置為 false
          if (typeof window !== 'undefined' && session?.user?.id) {
            const currentCache = sessionStorage.getItem(`partner_status_${session.user.id}`)
            if (!currentCache || currentCache === 'NONE') {
              setHasPartner(false)
              setIsPartner(false)
            }
          } else {
            setHasPartner(false)
            setIsPartner(false)
          }
        }
      } catch (error) {
        console.error('檢查夥伴狀態失敗:', error)
        // 網絡錯誤時，不清除緩存，保持當前狀態
        setPartnerLoading(false)
        // 如果沒有緩存，才設置為 false
        if (typeof window !== 'undefined' && session?.user?.id) {
          const currentCache = sessionStorage.getItem(`partner_status_${session.user.id}`)
          if (!currentCache || currentCache === 'NONE') {
            setHasPartner(false)
            setIsPartner(false)
          }
        } else {
          setHasPartner(false)
          setIsPartner(false)
        }
      }
    }
    
    // 背景更新（不影響 UI）
    async function checkPartnerStatusBackground() {
      try {
        const res = await fetch('/api/partners/self', {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        if (res.ok) {
          const data = await res.json()
          const hasPartner = !!data?.partner
          const isApproved = data?.partner?.status === 'APPROVED'
          
          setHasPartner(isApproved)
          setIsPartner(hasPartner)
          
          // 更新緩存
          if (typeof window !== 'undefined' && session?.user?.id) {
            if (hasPartner) {
              sessionStorage.setItem(`partner_status_${session.user.id}`, data.partner.status || '')
              sessionStorage.setItem(`partner_status_timestamp_${session.user.id}`, Date.now().toString())
            } else {
              sessionStorage.setItem(`partner_status_${session.user.id}`, 'NONE')
              sessionStorage.setItem(`partner_status_timestamp_${session.user.id}`, Date.now().toString())
            }
          }
        }
      } catch (error) {
        // 背景更新失敗不影響 UI
        console.warn('背景更新夥伴狀態失敗:', error)
      }
    }
  }, [session, status])

  // 處理點擊外部關閉用戶選單
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [userMenuRef])

  return (
    <nav className="bg-gradient-to-r from-gray-800 to-gray-900 shadow-lg sticky top-0 z-50">
      <div className="w-full flex items-center justify-between px-4 sm:px-6 py-4">
        {/* 左側：品牌標誌 */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          <Link href="/" className="text-white text-xl font-bold">
            PeiPlay
          </Link>
        </div>

        {/* 右側：導航項目 + 用戶圖標 */}
        <div className="flex items-center space-x-6">
          <Link href="/booking" className="flex items-center space-x-2 text-white hover:text-blue-300 transition-colors">
            <span className="text-xl">🎮</span>
            <span className="font-medium">預約陪玩</span>
          </Link>
          <Link href="/ranking" className="flex items-center space-x-2 text-white hover:text-yellow-300 transition-colors">
            <span className="text-xl">🏆</span>
            <span className="font-medium">排行榜</span>
          </Link>
          <Link href="/partners" className="flex items-center space-x-2 text-white hover:text-blue-300 transition-colors">
            <span className="text-xl">🔍</span>
            <span className="font-medium">搜尋夥伴</span>
          </Link>
          {!isPartner && (
            <Link href="/join" className="flex items-center space-x-2 text-white hover:text-red-300 transition-colors">
              <span className="text-xl">💼</span>
              <span className="font-medium">加入我們</span>
            </Link>
          )}
          
          {/* 用戶圖標 */}
          <div className="relative" ref={userMenuRef}>
            {session?.user ? (
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="w-9 h-9 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg flex items-center justify-center transition-all duration-200 border border-gray-600 hover:border-purple-400"
              >
                <span className="text-purple-400 text-lg">👤</span>
              </button>
            ) : (
              <Link href="/auth/login" className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg text-white font-semibold transition-all">
                登入
              </Link>
            )}

            {/* 用戶下拉選單 */}
            {userMenuOpen && session?.user && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl py-4 border border-gray-200" style={{ zIndex: 9999 }}>
                <div className="px-4 py-3 border-b border-gray-200 text-center">
                  <p className="text-sm text-gray-500">Signed in as</p>
                  <p className="font-semibold text-gray-900 text-lg">{session.user.name || session.user.email}</p>
                </div>
                
                {/* 時段管理 - 夥伴功能 */}
                {isPartner && (
                  <div className="px-4 py-3">
                    <Link 
                      href="/partner/schedule" 
                      prefetch={true}
                      className="flex items-center space-x-3 text-gray-900 hover:text-blue-600 hover:bg-blue-50 transition-colors rounded-lg px-2 py-2"
                    >
                      <span className="text-xl">📅</span>
                      <span className="font-medium">時段管理</span>
                    </Link>
                  </div>
                )}
                {partnerLoading && !isPartner && (
                  <div className="px-4 py-3">
                    <div className="flex items-center space-x-3 text-gray-500">
                      <span className="text-xl">🔄</span>
                      <span className="text-sm">載入中...</span>
                    </div>
                  </div>
                )}
                
                {/* 預約管理 */}
                <div className="px-4 py-3">
                  <Link href="/bookings" className="flex items-center space-x-3 text-gray-900 hover:text-orange-600 hover:bg-orange-50 transition-colors rounded-lg px-2 py-2">
                    <span className="text-xl">📋</span>
                    <span className="font-medium">預約管理</span>
                  </Link>
                </div>
                
                {/* 個人資料 */}
                <div className="px-4 py-3">
                  <Link href="/profile" className="flex items-center space-x-3 text-purple-600 hover:text-purple-700 hover:bg-purple-50 transition-colors rounded-lg px-2 py-2">
                    <span className="text-xl">👤</span>
                    <span className="font-medium">個人資料</span>
                  </Link>
                </div>
                
                {/* 設定 */}
                <div className="px-4 py-3">
                  <Link href="/profile/settings" className="flex items-center space-x-3 text-gray-900 hover:text-gray-600 hover:bg-gray-50 transition-colors rounded-lg px-2 py-2">
                    <span className="text-xl">⚙️</span>
                    <span className="font-medium">設定</span>
                  </Link>
                </div>
                
                {/* 登出 */}
                <div className="border-t border-gray-200 mt-2 pt-2">
                  <button 
                    onClick={() => signOut()} 
                    className="w-full flex items-center space-x-3 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors rounded-lg px-4 py-3"
                  >
                    <span className="text-xl">🚪</span>
                    <span className="font-medium">登出</span>
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