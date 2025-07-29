'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { FaBolt, FaCrown, FaMedal, FaTrophy } from 'react-icons/fa'
import { useRouter } from 'next/navigation'

interface RankingPartner {
  id: string
  name: string
  coverImage?: string
  games: string[]
  halfHourlyRate: number
  isAvailableNow: boolean
  isRankBooster: boolean
  totalMinutes: number
  totalHours: number
  rank: number
}

export default function RankingPage() {
  const [rankingData, setRankingData] = useState<RankingPartner[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchRankingData()
  }, [])

  const fetchRankingData = async () => {
    try {
      const response = await fetch('/api/partners/ranking')
      if (response.ok) {
        const data = await response.json()
        setRankingData(data)
      } else {
        console.error('Failed to fetch ranking data')
      }
    } catch (error) {
      console.error('Error fetching ranking data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <FaCrown className="text-yellow-400 text-2xl" />
      case 2:
        return <FaMedal className="text-gray-300 text-xl" />
      case 3:
        return <FaTrophy className="text-amber-600 text-xl" />
      default:
        return <span className="text-gray-500 font-bold">{rank}</span>
    }
  }

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white"
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800"
      case 3:
        return "bg-gradient-to-r from-amber-500 to-amber-600 text-white"
      default:
        return "bg-white hover:bg-gray-50"
    }
  }

  const handlePartnerClick = (partnerId: string) => {
    router.push(`/booking?partnerId=${partnerId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">載入排行榜中...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* 標題區域 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">排行榜</h1>
          <p className="text-gray-600">根據預約總時長排序的夥伴排名</p>
        </div>

        {/* TOP 3 特殊展示區域 */}
        {rankingData.length > 0 && (
          <div className="mb-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">TOP</h2>
              <p className="text-gray-600">達人榜</p>
            </div>
            
            <div className="flex justify-center items-end gap-4 mb-8">
              {/* 第二名 */}
              {rankingData[1] && (
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 relative mb-2">
                    {rankingData[1].coverImage ? (
                      <Image
                        src={rankingData[1].coverImage}
                        alt={rankingData[1].name}
                        fill
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-600">
                          {rankingData[1].name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-gray-300 text-2xl mb-1">🥈</div>
                    <h3 className="font-bold text-gray-700">{rankingData[1].name}</h3>
                    <p className="text-sm text-gray-600">{rankingData[1].totalHours} 小時</p>
                  </div>
                </div>
              )}

              {/* 第一名 */}
              {rankingData[0] && (
                <div className="flex flex-col items-center">
                  <div className="w-32 h-32 relative mb-2">
                    {rankingData[0].coverImage ? (
                      <Image
                        src={rankingData[0].coverImage}
                        alt={rankingData[0].name}
                        fill
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-32 h-32 bg-yellow-300 rounded-full flex items-center justify-center">
                        <span className="text-3xl font-bold text-yellow-700">
                          {rankingData[0].name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-400 text-3xl mb-1">👑</div>
                    <h3 className="font-bold text-gray-800 text-lg">{rankingData[0].name}</h3>
                    <p className="text-sm text-gray-600">{rankingData[0].totalHours} 小時</p>
                  </div>
                </div>
              )}

              {/* 第三名 */}
              {rankingData[2] && (
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 relative mb-2">
                    {rankingData[2].coverImage ? (
                      <Image
                        src={rankingData[2].coverImage}
                        alt={rankingData[2].name}
                        fill
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-amber-300 rounded-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-amber-700">
                          {rankingData[2].name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-amber-600 text-2xl mb-1">🥉</div>
                    <h3 className="font-bold text-gray-700">{rankingData[2].name}</h3>
                    <p className="text-sm text-gray-600">{rankingData[2].totalHours} 小時</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 完整排行榜列表 */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
            <h3 className="text-xl font-bold text-white">夥伴 TOP 100 排行</h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {rankingData.map((partner, index) => (
              <div
                key={partner.id}
                className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${getRankStyle(partner.rank)}`}
                onClick={() => handlePartnerClick(partner.id)}
              >
                <div className="flex items-center space-x-4">
                  {/* 排名 */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
                    {getRankIcon(partner.rank)}
                  </div>

                  {/* 頭像 */}
                  <div className="w-12 h-12 relative">
                    {partner.coverImage ? (
                      <Image
                        src={partner.coverImage}
                        alt={partner.name}
                        fill
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="font-bold text-gray-600">
                          {partner.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 夥伴資訊 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-gray-800">{partner.name}</h4>
                      {partner.isAvailableNow && (
                        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500 text-white text-xs font-bold">
                          <FaBolt className="text-yellow-200" />
                          <span>現在有空</span>
                        </span>
                      )}
                      {partner.isRankBooster && (
                        <span className="inline-block bg-gradient-to-r from-yellow-400 via-orange-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          上分高手
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>總時長：{partner.totalHours} 小時</span>
                      <span>•</span>
                      <span>${partner.halfHourlyRate}/半小時</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-1">
                      {partner.games.slice(0, 3).map((game) => (
                        <span
                          key={game}
                          className="inline-block bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-semibold"
                        >
                          {game}
                        </span>
                      ))}
                      {partner.games.length > 3 && (
                        <span className="text-xs text-gray-500">+{partner.games.length - 3}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 預約按鈕 */}
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePartnerClick(partner.id)
                  }}
                >
                  預約
                </button>
              </div>
            ))}
          </div>

          {rankingData.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <p>目前還沒有排行榜資料</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}