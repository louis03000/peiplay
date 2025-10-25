'use client'

import { useState, useEffect } from 'react'

interface RankingData {
  id: string
  name: string
  games: string[]
  rating: number
  totalBookings: number
  coverImage?: string
  rank: number
  isTrending?: boolean
}

export default function RankingPage() {
  const [rankings, setRankings] = useState<RankingData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGame, setSelectedGame] = useState('all')
  const [timeFilter, setTimeFilter] = useState('week')

  const gameOptions = [
    { value: 'all', label: '全部遊戲', icon: '🏆' },
    { value: '英雄聯盟', label: '英雄聯盟', icon: '⚔️' },
    { value: '特戰英豪', label: '特戰英豪', icon: '🎯' },
    { value: 'Apex 英雄', label: 'Apex 英雄', icon: '🚀' },
    { value: 'CS:GO', label: 'CS:GO', icon: '🔫' },
    { value: 'PUBG', label: 'PUBG', icon: '🏃' }
  ]

  const timeOptions = [
    { value: 'week', label: '本週' },
    { value: 'month', label: '本月' },
    { value: 'all', label: '全部時間' }
  ]

  useEffect(() => {
    const fetchRankings = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (selectedGame !== 'all') {
          params.append('game', selectedGame)
        }
        params.append('timeFilter', timeFilter)
        
        const response = await fetch(`/api/partners/ranking?${params}`)
        if (response.ok) {
          const data = await response.json()
          setRankings(data)
        } else {
          // 設置默認數據
          setRankings([
            {
              id: '1',
              name: '遊戲高手小陳',
              games: ['英雄聯盟', '特戰英豪'],
              rating: 4.9,
              totalBookings: 234,
              rank: 1,
              isTrending: true
            },
            {
              id: '2',
              name: '電競女神小雨',
              games: ['Apex 英雄', 'CS:GO'],
              rating: 4.8,
              totalBookings: 189,
              rank: 2,
              isTrending: true
            },
            {
              id: '3',
              name: '專業陪玩阿明',
              games: ['PUBG', '英雄聯盟'],
              rating: 4.7,
              totalBookings: 156,
              rank: 3,
              isTrending: false
            },
            {
              id: '4',
              name: '遊戲達人小華',
              games: ['特戰英豪', 'Apex 英雄'],
              rating: 4.6,
              totalBookings: 143,
              rank: 4,
              isTrending: false
            },
            {
              id: '5',
              name: '電競選手小強',
              games: ['CS:GO', 'PUBG'],
              rating: 4.5,
              totalBookings: 128,
              rank: 5,
              isTrending: true
            }
          ])
        }
      } catch (error) {
        console.error('Failed to fetch rankings:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRankings()
  }, [selectedGame, timeFilter])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      default: return `#${rank}`
    }
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
    <div className="min-h-screen" style={{backgroundColor: '#E4E7EB'}}>

      {/* Hero Section */}
      <div className="relative py-24 px-6 overflow-hidden">
        {/* 背景漸層 */}
        <div className="absolute inset-0 bg-gradient-to-br from-#1A73E8 via-#5C7AD6 to-#1A73E8 opacity-95"></div>
        
        {/* 幾何裝飾元素 */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white opacity-10 rounded-full blur-xl"></div>
        <div className="absolute bottom-10 right-10 w-48 h-48 bg-white opacity-5 rounded-full blur-2xl"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-white opacity-20 rotate-45 blur-lg"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-8" style={{color: 'white'}}>
            夥伴排行榜
          </h1>
          <div className="w-24 h-1 mx-auto mb-8" style={{backgroundColor: '#5C7AD6'}}></div>
          <p className="text-xl sm:text-2xl mb-12 max-w-4xl mx-auto" style={{color: 'white', opacity: 0.95}}>
            看看最受歡迎的遊戲夥伴，選擇最適合您的陪玩專家
          </p>
        </div>
      </div>

      {/* 篩選器 */}
      <div className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-6 items-center justify-between mb-8">
            {/* 遊戲篩選 */}
            <div className="flex flex-wrap gap-3">
              {gameOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedGame(option.value)}
                  className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${
                    selectedGame === option.value 
                      ? 'shadow-lg transform scale-105' 
                      : 'hover:shadow-lg'
                  }`}
                  style={{
                    backgroundColor: selectedGame === option.value ? '#1A73E8' : 'white',
                    color: selectedGame === option.value ? 'white' : '#333140',
                    boxShadow: selectedGame === option.value ? '0 8px 32px rgba(26, 115, 232, 0.3)' : '0 4px 20px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  <span className="mr-2">{option.icon}</span>
                  {option.label}
                </button>
              ))}
            </div>

            {/* 時間篩選 */}
            <div className="flex gap-3">
              {timeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeFilter(option.value)}
                  className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${
                    timeFilter === option.value 
                      ? 'shadow-lg transform scale-105' 
                      : 'hover:shadow-lg'
                  }`}
                  style={{
                    backgroundColor: timeFilter === option.value ? '#5C7AD6' : 'white',
                    color: timeFilter === option.value ? 'white' : '#333140',
                    boxShadow: timeFilter === option.value ? '0 8px 32px rgba(92, 122, 214, 0.3)' : '0 4px 20px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 排行榜列表 */}
          {loading ? (
            <div className="text-center py-24">
              <div className="relative">
                <div className="w-20 h-20 mx-auto mb-8 rounded-full border-4 border-gray-200 border-t-#1A73E8 animate-spin"></div>
                <div className="text-2xl font-medium" style={{color: '#333140'}}>載入排行榜中...</div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {rankings.map((partner, index) => (
                <div key={partner.id} className="group p-8 rounded-3xl transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 transform" 
                     style={{backgroundColor: 'white', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'}}>
                  <div className="flex items-center gap-6">
                    {/* 排名 */}
                    <div className="flex-shrink-0">
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold transition-all duration-300 group-hover:scale-110 ${
                        index < 3 ? 'shadow-lg' : ''
                      }`} style={{
                        background: index === 0 ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' :
                                   index === 1 ? 'linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 100%)' :
                                   index === 2 ? 'linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)' :
                                   'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                        color: 'white'
                      }}>
                        {getRankIcon(partner.rank)}
                      </div>
                    </div>

                    {/* 頭像 */}
                    <div className="flex-shrink-0">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-#1A73E8 to-#5C7AD6 flex items-center justify-center">
                        {partner.coverImage ? (
                          <img src={partner.coverImage} alt={partner.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-3xl">🎮</span>
                        )}
                      </div>
                    </div>

                    {/* 資訊 */}
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold" style={{color: '#333140'}}>
                          {partner.name}
                        </h3>
                        {partner.isTrending && (
                          <div className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500 text-white animate-pulse">
                            🔥 熱門
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-6 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400 text-lg">⭐</span>
                          <span className="text-lg font-semibold" style={{color: '#333140'}}>
                            {partner.rating}
                          </span>
                        </div>
                        <div className="text-sm" style={{color: '#333140', opacity: 0.7}}>
                          {partner.totalBookings} 次預約
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {partner.games.map((game, gameIndex) => (
                          <div key={gameIndex} className="flex items-center gap-1 px-3 py-1 rounded-full text-sm" 
                               style={{backgroundColor: '#E4E7EB', color: '#333140'}}>
                            <span>{getGameIcon(game)}</span>
                            <span>{game}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 行動按鈕 */}
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => window.location.href = `/booking?partnerId=${partner.id}`}
                        className="px-8 py-4 rounded-2xl font-semibold transition-all duration-300 hover:shadow-xl hover:scale-105 transform"
                        style={{
                          background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                          color: 'white'
                        }}
                      >
                        立即預約
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 底部 CTA */}
      <div className="py-24 px-6" style={{backgroundColor: 'white'}}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-8" style={{color: '#333140'}}>
            找不到適合的夥伴？
          </h2>
          <p className="text-xl mb-12" style={{color: '#333140', opacity: 0.8}}>
            查看更多夥伴，或成為我們的專業陪玩夥伴
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button
              onClick={() => window.location.href = '/partners'}
              className="px-12 py-5 rounded-2xl font-semibold text-xl transition-all duration-300 hover:shadow-xl hover:scale-105 transform"
              style={{
                background: 'linear-gradient(135deg, #1A73E8 0%, #5C7AD6 100%)',
                color: 'white'
              }}
            >
              查看更多夥伴
            </button>
            <button
              onClick={() => window.location.href = '/join'}
              className="px-12 py-5 rounded-2xl font-semibold text-xl border-2 transition-all duration-300 hover:shadow-xl hover:scale-105 transform"
              style={{
                backgroundColor: 'transparent',
                color: '#1A73E8',
                borderColor: '#1A73E8'
              }}
            >
              成為夥伴
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}