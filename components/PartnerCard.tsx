'use client'

import { useState } from 'react'
import { Partner } from '@/app/partners/page'

interface PartnerCardProps {
  partner: Partner
  onQuickBook?: (partnerId: string) => void
  showNextStep?: boolean
  flipped?: boolean
  onFlip?: () => void
}

export default function PartnerCard({ 
  partner, 
  onQuickBook, 
  showNextStep = false,
  flipped = false,
  onFlip 
}: PartnerCardProps) {
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const handleImageError = () => {
    setImageError(true)
  }

  const getGameIcon = (game: string) => {
    const gameIcons: { [key: string]: string } = {
      '英雄聯盟': '⚔️',
      '特戰英豪': '🎯',
      'Apex 英雄': '🚀',
      'CS:GO': '🔫',
      'PUBG': '🏃',
      'Valorant': '🎯',
      'LOL': '⚔️',
      'APEX': '🚀'
    }
    return gameIcons[game] || '🎮'
  }

  return (
    <div 
      className={`relative w-full transition-all duration-700 transform ${
        flipped ? 'rotate-y-180' : ''
      }`} 
      style={{ perspective: '1000px' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 正面 */}
      <div className={`absolute inset-0 w-full h-full transition-all duration-700 ${
        flipped ? 'rotate-y-180 opacity-0' : 'opacity-100'
      }`}>
        <div className={`group h-full rounded-3xl overflow-hidden transition-all duration-700 hover:shadow-2xl transform ${
          isHovered ? '-translate-y-4 scale-105' : ''
        }`} 
             style={{backgroundColor: 'white', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)'}}>
          
          {/* 封面圖片區域 */}
          <div className="relative h-64 overflow-hidden">
            {partner.coverImage && !imageError ? (
              <img
                src={partner.coverImage}
                alt={`${partner.name} 的封面`}
                className={`w-full h-full object-cover transition-all duration-700 ${
                  isHovered ? 'scale-110' : 'scale-100'
                }`}
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center relative" 
                   style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)'}}>
                <div className="text-center">
                  <div className={`text-8xl mb-4 transition-all duration-500 ${
                    isHovered ? 'scale-125 rotate-12' : ''
                  }`}>🎮</div>
                  <div className="text-white text-xl font-bold">{partner.name}</div>
                </div>
                {/* 動態背景裝飾 */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10 animate-pulse"></div>
              </div>
            )}
            
            {/* 狀態標籤 */}
            <div className="absolute top-4 left-4 flex gap-2">
              {partner.isAvailableNow && (
                <div className={`px-4 py-2 rounded-full text-sm font-bold bg-green-500 text-white shadow-lg transition-all duration-500 ${
                  isHovered ? 'scale-110' : ''
                }`}>
                  <span className="animate-pulse">●</span> 即時可用
                </div>
              )}
              {partner.isRankBooster && (
                <div className={`px-4 py-2 rounded-full text-sm font-bold bg-yellow-500 text-white shadow-lg transition-all duration-500 ${
                  isHovered ? 'scale-110' : ''
                }`}>
                  🏆 排名提升
                </div>
              )}
            </div>

            {/* 翻轉按鈕 */}
            {onFlip && (
              <button
                onClick={onFlip}
                className={`absolute top-4 right-4 w-12 h-12 rounded-2xl bg-white bg-opacity-90 hover:bg-opacity-100 transition-all duration-500 flex items-center justify-center shadow-lg ${
                  isHovered ? 'scale-110 rotate-12' : 'hover:scale-110'
                }`}
              >
                <span className="text-xl animate-spin">🔄</span>
              </button>
            )}

            {/* 懸停效果覆蓋層 */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent transition-opacity duration-500 ${
              isHovered ? 'opacity-30' : 'opacity-0'
            }`}></div>
          </div>

          {/* 內容區域 */}
          <div className="p-8">
            {/* 姓名和基本資訊 */}
            <div className="mb-6">
              <h3 className={`text-3xl font-bold mb-3 transition-all duration-500 ${
                isHovered ? 'text-#1A73E8' : ''
              }`} style={{color: '#333140'}}>
                {partner.name}
              </h3>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-yellow-400 text-xl animate-pulse">⭐</span>
                <span className="text-xl font-bold" style={{color: '#333140'}}>4.8</span>
                <span className="text-sm" style={{color: '#333140', opacity: 0.7}}>(128 評價)</span>
              </div>
            </div>

            {/* 遊戲標籤 */}
            <div className="mb-8">
              <div className="flex flex-wrap gap-2">
                {partner.games.slice(0, 3).map((game, index) => (
                  <div key={index} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-500 ${
                    isHovered ? 'scale-105' : ''
                  }`} 
                       style={{backgroundColor: '#E4E7EB', color: '#333140'}}>
                    <span className={`transition-transform duration-500 ${
                      isHovered ? 'scale-125' : ''
                    }`}>{getGameIcon(game)}</span>
                    <span>{game}</span>
                  </div>
                ))}
                {partner.games.length > 3 && (
                  <div className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-500 ${
                    isHovered ? 'scale-105' : ''
                  }`} 
                       style={{backgroundColor: '#E4E7EB', color: '#333140'}}>
                    +{partner.games.length - 3}
                  </div>
                )}
              </div>
            </div>

            {/* 價格和行動按鈕 */}
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-4xl font-bold transition-all duration-500 ${
                  isHovered ? 'scale-110' : ''
                }`} style={{color: '#1A73E8'}}>
                  ${partner.halfHourlyRate}
                </div>
                <div className="text-sm" style={{color: '#333140', opacity: 0.7}}>
                  每半小時
                </div>
              </div>
              
              <div className="flex gap-3">
                {onQuickBook && (
                  <button
                    onClick={() => onQuickBook(partner.id)}
                    className={`px-6 py-3 rounded-2xl font-bold transition-all duration-500 hover:shadow-xl transform ${
                      isHovered ? 'scale-105' : 'hover:scale-105'
                    }`}
                    style={{
                      background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                      color: 'white',
                      boxShadow: '0 8px 24px rgba(26, 115, 232, 0.3)'
                    }}
                  >
                    快速預約
                  </button>
                )}
                {showNextStep && (
                  <button
                    onClick={() => window.location.href = `/booking?partnerId=${partner.id}`}
                    className={`px-6 py-3 rounded-2xl font-bold border-2 transition-all duration-500 hover:shadow-xl transform ${
                      isHovered ? 'scale-105' : 'hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: 'transparent',
                      color: '#1A73E8',
                      borderColor: '#1A73E8'
                    }}
                  >
                    詳細預約
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 背面 */}
      <div className={`absolute inset-0 w-full h-full transition-all duration-700 ${
        flipped ? 'opacity-100' : 'rotate-y-180 opacity-0'
      }`}>
        <div className={`h-full rounded-3xl overflow-hidden transition-all duration-700 ${
          isHovered ? '-translate-y-2' : ''
        }`} 
             style={{backgroundColor: 'white', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.1)'}}>
          
          {/* 背面標題 */}
          <div className="h-20 flex items-center justify-center relative" 
               style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)'}}>
            <h3 className="text-2xl font-bold text-white">{partner.name}</h3>
            {/* 動態背景 */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10 animate-pulse"></div>
          </div>

          {/* 詳細資訊 */}
          <div className="p-8">
            {/* 個人訊息 */}
            {partner.customerMessage && (
              <div className="mb-8">
                <h4 className="text-xl font-bold mb-4 flex items-center gap-2" style={{color: '#333140'}}>
                  <span className="text-2xl">💬</span>
                  個人訊息
                </h4>
                <div className="p-4 rounded-2xl" style={{backgroundColor: '#E4E7EB'}}>
                  <p className="text-sm leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                    "{partner.customerMessage}"
                  </p>
                </div>
              </div>
            )}

            {/* 所有遊戲 */}
            <div className="mb-8">
              <h4 className="text-xl font-bold mb-4 flex items-center gap-2" style={{color: '#333140'}}>
                <span className="text-2xl">🎮</span>
                擅長遊戲
              </h4>
              <div className="flex flex-wrap gap-2">
                {partner.games.map((game, index) => (
                  <div key={index} className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-500 ${
                    isHovered ? 'scale-105' : ''
                  }`} 
                       style={{backgroundColor: '#E4E7EB', color: '#333140'}}>
                    <span className={`transition-transform duration-500 ${
                      isHovered ? 'scale-125' : ''
                    }`}>{getGameIcon(game)}</span>
                    <span>{game}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 可用時段 */}
            <div className="mb-8">
              <h4 className="text-xl font-bold mb-4 flex items-center gap-2" style={{color: '#333140'}}>
                <span className="text-2xl">⏰</span>
                可用時段
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {partner.schedules.slice(0, 4).map((schedule, index) => (
                  <div key={index} className={`text-xs p-3 rounded-2xl text-center transition-all duration-500 ${
                    isHovered ? 'scale-105' : ''
                  }`} 
                       style={{backgroundColor: schedule.isAvailable ? '#E8F5E8' : '#FFE8E8', 
                               color: schedule.isAvailable ? '#2E7D32' : '#D32F2F'}}>
                    <div className="font-bold text-sm">
                      {new Date(schedule.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="font-medium">
                      {new Date(schedule.startTime).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 翻回正面按鈕 */}
            <div className="text-center">
              <button
                onClick={onFlip}
                className={`px-8 py-4 rounded-2xl font-bold transition-all duration-500 hover:shadow-xl transform ${
                  isHovered ? 'scale-105' : 'hover:scale-105'
                }`}
                style={{
                  background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                  color: 'white',
                  boxShadow: '0 8px 24px rgba(26, 115, 232, 0.3)'
                }}
              >
                <span className="flex items-center gap-2">
                  查看正面
                  <span className="text-lg">👀</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}