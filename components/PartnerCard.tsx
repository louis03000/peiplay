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
    <div className={`relative w-full transition-all duration-500 transform ${
      flipped ? 'rotate-y-180' : ''
    }`} style={{ perspective: '1000px' }}>
      {/* 正面 */}
      <div className={`absolute inset-0 w-full h-full transition-all duration-500 ${
        flipped ? 'rotate-y-180 opacity-0' : 'opacity-100'
      }`}>
        <div className="group h-full rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 transform" 
             style={{backgroundColor: 'white', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'}}>
          
          {/* 封面圖片區域 */}
          <div className="relative h-56 overflow-hidden">
            {partner.coverImage && !imageError ? (
              <img
                src={partner.coverImage}
                alt={`${partner.name} 的封面`}
                className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center" 
                   style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)'}}>
                <div className="text-center">
                  <div className="text-6xl mb-4">🎮</div>
                  <div className="text-white text-lg font-semibold">{partner.name}</div>
                </div>
              </div>
            )}
            
            {/* 狀態標籤 */}
            <div className="absolute top-4 left-4 flex gap-2">
              {partner.isAvailableNow && (
                <div className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500 text-white shadow-lg">
                  即時可用
                </div>
              )}
              {partner.isRankBooster && (
                <div className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500 text-white shadow-lg">
                  排名提升
                </div>
              )}
            </div>

            {/* 翻轉按鈕 */}
            {onFlip && (
              <button
                onClick={onFlip}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 transition-all duration-300 flex items-center justify-center shadow-lg hover:scale-110"
              >
                <span className="text-lg">🔄</span>
              </button>
            )}
          </div>

          {/* 內容區域 */}
          <div className="p-6">
            {/* 姓名和基本資訊 */}
            <div className="mb-4">
              <h3 className="text-2xl font-bold mb-2" style={{color: '#333140'}}>
                {partner.name}
              </h3>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-yellow-400 text-lg">⭐</span>
                <span className="text-lg font-semibold" style={{color: '#333140'}}>4.8</span>
                <span className="text-sm" style={{color: '#333140', opacity: 0.7}}>(128 評價)</span>
              </div>
            </div>

            {/* 遊戲標籤 */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                {partner.games.slice(0, 3).map((game, index) => (
                  <div key={index} className="flex items-center gap-1 px-3 py-1 rounded-full text-sm" 
                       style={{backgroundColor: '#E4E7EB', color: '#333140'}}>
                    <span>{getGameIcon(game)}</span>
                    <span>{game}</span>
                  </div>
                ))}
                {partner.games.length > 3 && (
                  <div className="px-3 py-1 rounded-full text-sm" 
                       style={{backgroundColor: '#E4E7EB', color: '#333140'}}>
                    +{partner.games.length - 3}
                  </div>
                )}
              </div>
            </div>

            {/* 價格和行動按鈕 */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold" style={{color: '#1A73E8'}}>
                  ${partner.halfHourlyRate}
                </div>
                <div className="text-sm" style={{color: '#333140', opacity: 0.7}}>
                  每半小時
                </div>
              </div>
              
              <div className="flex gap-2">
                {onQuickBook && (
                  <button
                    onClick={() => onQuickBook(partner.id)}
                    className="px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105 transform"
                    style={{
                      background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                      color: 'white'
                    }}
                  >
                    快速預約
                  </button>
                )}
                {showNextStep && (
                  <button
                    onClick={() => window.location.href = `/booking?partnerId=${partner.id}`}
                    className="px-6 py-3 rounded-xl font-semibold border-2 transition-all duration-300 hover:shadow-lg hover:scale-105 transform"
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
      <div className={`absolute inset-0 w-full h-full transition-all duration-500 ${
        flipped ? 'opacity-100' : 'rotate-y-180 opacity-0'
      }`}>
        <div className="h-full rounded-3xl overflow-hidden" 
             style={{backgroundColor: 'white', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'}}>
          
          {/* 背面標題 */}
          <div className="h-16 flex items-center justify-center" 
               style={{background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)'}}>
            <h3 className="text-xl font-bold text-white">{partner.name}</h3>
          </div>

          {/* 詳細資訊 */}
          <div className="p-6">
            {/* 個人訊息 */}
            {partner.customerMessage && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold mb-3" style={{color: '#333140'}}>
                  個人訊息
                </h4>
                <p className="text-sm leading-relaxed" style={{color: '#333140', opacity: 0.8}}>
                  {partner.customerMessage}
                </p>
              </div>
            )}

            {/* 所有遊戲 */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3" style={{color: '#333140'}}>
                擅長遊戲
              </h4>
              <div className="flex flex-wrap gap-2">
                {partner.games.map((game, index) => (
                  <div key={index} className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm" 
                       style={{backgroundColor: '#E4E7EB', color: '#333140'}}>
                    <span>{getGameIcon(game)}</span>
                    <span>{game}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 可用時段 */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3" style={{color: '#333140'}}>
                可用時段
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {partner.schedules.slice(0, 4).map((schedule, index) => (
                  <div key={index} className="text-xs p-2 rounded-lg text-center" 
                       style={{backgroundColor: schedule.isAvailable ? '#E8F5E8' : '#FFE8E8', 
                               color: schedule.isAvailable ? '#2E7D32' : '#D32F2F'}}>
                    <div className="font-medium">
                      {new Date(schedule.date).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                    </div>
                    <div>
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
                className="px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:shadow-lg hover:scale-105 transform"
                style={{
                  background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                  color: 'white'
                }}
              >
                查看正面
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}