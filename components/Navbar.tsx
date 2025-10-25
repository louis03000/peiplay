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
            // 成功時立即停止載入
            setPartnerLoading(false)
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
            setPartnerLoading(false)
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
          setPartnerLoading(false)
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
    <nav className="bg-gradient-to-r from-gray-800 to-gray-900 shadow-lg sticky top-0 z-50">
      <div className="w-full flex items-center justify-between px-4 sm:px-6 py-3">
        {/* 左側：品牌標誌 + 導航項目 */}
        <div className="flex items-center space-x-8">
          {/* 品牌標誌 */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">P</span>
            </div>
            <span className="text-white font-bold">PeiPlay</span>
          </div>
          
          {/* 左側導航項目 */}
          <div className="flex items-center space-x-4">
            <Link href="/booking" className="flex items-center space-x-1.5 text-white hover:text-blue-300 transition-colors">
              <span className="text-lg">🎮</span>
              <span className="font-medium text-sm">預約陪玩</span>
            </Link>
            <Link href="/ranking" className="flex items-center space-x-1.5 text-white hover:text-yellow-300 transition-colors">
              <span className="text-lg">🏆</span>
              <span className="font-medium text-sm">排行榜</span>
            </Link>
          </div>
        </div>

        {/* 右側：導航項目 + 用戶圖標 */}
        <div className="flex items-center space-x-4">
          <Link href="/partners" className="flex items-center space-x-1.5 text-white hover:text-blue-300 transition-colors">
            <span className="text-lg">🔍</span>
            <span className="font-medium text-sm">搜尋夥伴</span>
          </Link>
          {!isPartner && (
            <Link href="/join" className="flex items-center space-x-1.5 text-white hover:text-red-300 transition-colors">
              <span className="text-lg">💼</span>
              <span className="font-medium text-sm">加入我們</span>
            </Link>
          )}
          
          {/* 用戶圖標 - 縮小 */}
          <div className="relative" ref={menuRef}>
            {session?.user ? (
              <button 
                onClick={() => setMenuOpen(!menuOpen)} 
                className="w-7 h-7 bg-gray-700/50 hover:bg-gray-600/50 rounded flex items-center justify-center transition-all duration-200 border border-gray-600 hover:border-purple-400"
              >
                <span className="text-purple-400 text-sm">👤</span>
              </button>
            ) : (
              <Link href="/auth/login" className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-lg text-white text-sm font-semibold transition-all">
                登入
              </Link>
            )}

            {/* 下拉選單 */}
            {menuOpen && session?.user && (
              <div className="absolute right-0 mt-3 w-64 bg-white rounded-xl shadow-xl py-4 border border-gray-200 z-50">
                <div className="px-4 py-3 border-b border-gray-200 text-center">
                  <p className="text-sm text-gray-500">Signed in as</p>
                  <p className="font-semibold text-gray-900 text-lg">{session.user.name || session.user.email}</p>
                </div>
                
                {/* 時段管理 - 夥伴功能 */}
                {partnerLoading ? (
                  <div className="px-4 py-3">
                    <div className="flex items-center space-x-3 text-gray-500">
                      <span className="text-xl">🔄</span>
                      <span className="text-sm">載入中...</span>
                    </div>
                  </div>
                ) : isPartner && (
                  <div className="px-4 py-3">
                    <Link href="/partner/schedule" className="flex items-center space-x-3 text-gray-900 hover:text-blue-600 hover:bg-blue-50 transition-colors rounded-lg px-2 py-2">
                      <span className="text-xl">📅</span>
                      <span className="font-medium">時段管理</span>
                    </Link>
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