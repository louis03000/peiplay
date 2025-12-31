'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import SecureImage from '@/components/SecureImage'
import GameIcon from '@/components/GameIcon'

interface RankingData {
  id: string
  name: string
  games: string[]
  totalMinutes: number
  coverImage?: string
  rank: number
  isAvailableNow?: boolean
  isRankBooster?: boolean
}

export default function RankingPage() {
  const { data: session } = useSession()
  const [rankings, setRankings] = useState<RankingData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPartnerId, setCurrentPartnerId] = useState<string | null>(null)
  const [selectedGame, setSelectedGame] = useState('all')
  const [timeFilter, setTimeFilter] = useState('week')
  
  // 其他遊戲選項相關狀態
  const [showOtherGames, setShowOtherGames] = useState(false)
  const [registeredGames, setRegisteredGames] = useState<Array<{
    original: string
    english: string
    chinese: string
    display: string
  }>>([])
  const [loadingRegisteredGames, setLoadingRegisteredGames] = useState(false)

  const gameOptions = [
    { value: 'all', label: '全部遊戲', icon: '🏆', isGame: false },
    { value: '英雄聯盟', label: '英雄聯盟', icon: null, isGame: true },
    { value: '特戰英豪', label: '特戰英豪', icon: null, isGame: true },
    { value: 'Apex 英雄', label: 'Apex 英雄', icon: null, isGame: true },
    { value: 'CS:GO', label: 'CS:GO', icon: null, isGame: true },
    { value: 'PUBG', label: 'PUBG', icon: null, isGame: true },
    { value: '其他', label: '其他', icon: null, isGame: false }
  ]

  const timeOptions = [
    { value: 'week', label: '本週' },
    { value: 'month', label: '本月' }
  ]

  // 載入已登記的遊戲列表
  useEffect(() => {
    const loadRegisteredGames = async () => {
      setLoadingRegisteredGames(true)
      try {
        const response = await fetch('/api/games/registered')
        if (response.ok) {
          const data = await response.json()
          setRegisteredGames(data.games || [])
        }
      } catch (error) {
        console.error('載入已登記遊戲列表失敗:', error)
      } finally {
        setLoadingRegisteredGames(false)
      }
    }

    loadRegisteredGames()
  }, [])

  // 獲取當前用戶的夥伴ID
  useEffect(() => {
    const fetchCurrentPartner = async () => {
      if (session?.user?.id) {
        try {
          const response = await fetch('/api/partners/self')
          if (response.ok) {
            const data = await response.json()
            if (data?.partner?.id) {
              setCurrentPartnerId(data.partner.id)
            }
          }
        } catch (error) {
          console.error('Failed to fetch current partner:', error)
        }
      } else {
        setCurrentPartnerId(null)
      }
    }

    fetchCurrentPartner()
  }, [session])

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

  // 已移除 getGameIcon 函數，改用 GameIcon 組件

  return (
    <div className="min-h-screen" style={{backgroundColor: '#E4E7EB'}}>

      {/* Hero Section */}
      <div className="relative py-24 px-6 overflow-hidden" style={{backgroundColor: '#E4E7EB'}}>
        <div className="relative z-10 max-w-6xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-8 text-gray-800">
            夥伴排行榜
          </h1>
          <div className="w-24 h-1 mx-auto mb-8 bg-blue-600"></div>
          <p className="text-xl sm:text-2xl mb-12 max-w-4xl mx-auto text-gray-700">
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
                  onClick={() => {
                    if (option.value === '其他') {
                      setShowOtherGames(!showOtherGames)
                    } else {
                      setSelectedGame(option.value)
                      setShowOtherGames(false)
                    }
                  }}
                  className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 flex items-center gap-2 ${
                    (option.value === '其他' && showOtherGames) || selectedGame === option.value
                      ? 'shadow-lg transform scale-105' 
                      : 'hover:shadow-lg'
                  }`}
                  style={{
                    backgroundColor: (option.value === '其他' && showOtherGames) || selectedGame === option.value ? '#1A73E8' : 'white',
                    color: (option.value === '其他' && showOtherGames) || selectedGame === option.value ? 'white' : '#333140',
                    boxShadow: (option.value === '其他' && showOtherGames) || selectedGame === option.value ? '0 8px 32px rgba(26, 115, 232, 0.3)' : '0 4px 20px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  {option.isGame ? (
                    <GameIcon gameName={option.value} size={20} />
                  ) : (
                    <span>{option.icon}</span>
                  )}
                  <span>{option.label}</span>
                </button>
              ))}
              
              {/* 其他遊戲列表 - 水平展開 */}
              {showOtherGames && (
                <>
                  {loadingRegisteredGames ? (
                    <div className="px-6 py-3 rounded-xl bg-white text-gray-500">
                      載入中...
                    </div>
                  ) : registeredGames.length === 0 ? (
                    <div className="px-6 py-3 rounded-xl bg-white text-gray-500">
                      目前沒有已登記的遊戲
                    </div>
                  ) : (
                    registeredGames.map((game) => {
                      const isSelected = selectedGame === game.original
                      return (
                        <button
                          key={`${game.english}-${game.chinese}`}
                          onClick={() => {
                            setSelectedGame(game.original)
                            setShowOtherGames(false)
                          }}
                          className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 flex items-center gap-2 ${
                            isSelected
                              ? 'shadow-lg transform scale-105' 
                              : 'hover:shadow-lg'
                          }`}
                          style={{
                            backgroundColor: isSelected ? '#1A73E8' : 'white',
                            color: isSelected ? 'white' : '#333140',
                            boxShadow: isSelected ? '0 8px 32px rgba(26, 115, 232, 0.3)' : '0 4px 20px rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          <span className="text-sm">{game.display}</span>
                        </button>
                      )
                    })
                  )}
                </>
              )}
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
          {showOtherGames ? (
            // 當"其他"選單展開時，隱藏排行榜列表
            null
          ) : loading ? (
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
                      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-purple-400 to-blue-400 relative">
                        {partner.coverImage ? (
                          <SecureImage
                            src={partner.coverImage}
                            alt={partner.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-3xl">🎮</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 資訊 */}
                    <div className="flex-grow">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-2xl font-bold" style={{color: '#333140'}}>
                          {partner.name}
                        </h3>
                        {partner.isAvailableNow && (
                          <div className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500 text-white">
                            🟢 現在有空
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-6 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400 text-lg">⏱️</span>
                          <span className="text-lg font-semibold" style={{color: '#333140'}}>
                            {Math.floor(partner.totalMinutes / 60)} 小時 {partner.totalMinutes % 60} 分鐘
                          </span>
                        </div>
                        {/* 只有夥伴身分才能看到排名前10的獎勵信息 */}
                        {/* 🔥 只有「全部遊戲」的第一名才顯示2%減免，篩選器後的第一名不顯示 */}
                        {partner.rank <= 10 && session?.user?.partnerId && (
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            partner.rank === 1 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : partner.rank <= 3
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {partner.rank === 1 && selectedGame === 'all' && '🏆 平台維護費減免 2%'}
                            {partner.rank === 1 && selectedGame !== 'all' && '🥇 第一名'}
                            {partner.rank === 2 && '🥈 平台維護費減免 1%'}
                            {partner.rank === 3 && '🥉 平台維護費減免 1%'}
                            {partner.rank >= 4 && partner.rank <= 10 && '🎁 可申請優惠碼'}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {partner.games.map((game, gameIndex) => (
                          <div key={gameIndex} className="flex items-center gap-1 px-3 py-1 rounded-full text-sm" 
                               style={{backgroundColor: '#E4E7EB', color: '#333140'}}>
                            <GameIcon gameName={game} size={16} />
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