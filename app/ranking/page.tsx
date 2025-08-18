'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { FaBolt, FaCrown, FaMedal, FaTrophy } from 'react-icons/fa'

interface RankingPartner {
  id: string
  name: string
  games: string[]
  totalMinutes: number
  coverImage?: string
  isAvailableNow: boolean
  isRankBooster: boolean
  rank: number
}

export default function RankingPage() {
  const [rankingData, setRankingData] = useState<RankingPartner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const router = useRouter()

  const fetchRankingData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/partners/ranking', {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setRankingData(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching ranking data:', error)
      setError('載入排行榜資料時發生錯誤')
      
      // 自動重試機制
      if (retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1)
        }, 2000 * (retryCount + 1)) // 遞增延遲
      }
    } finally {
      setLoading(false)
    }
  }, [retryCount])

  useEffect(() => {
    fetchRankingData()
  }, [fetchRankingData])

  // 當重試次數改變時重新獲取資料
  useEffect(() => {
    if (retryCount > 0) {
      fetchRankingData()
    }
  }, [retryCount, fetchRankingData])

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

  const handlePartnerClick = useCallback((partnerId: string) => {
    router.push(`/booking?partnerId=${partnerId}`)
  }, [router])

  const handleRetry = useCallback(() => {
    setRetryCount(0)
    setError(null)
    fetchRankingData()
  }, [fetchRankingData])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">載入排行榜中...</p>
            {retryCount > 0 && (
              <p className="text-gray-500 text-sm mt-2">重試中... ({retryCount}/3)</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">載入失敗</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button 
              onClick={handleRetry}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              重新載入
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f172a] pt-32">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">夥伴 TOP 100 排行</h1>
          <p className="text-gray-300 text-lg">根據預約總時長排序的夥伴排行榜</p>
        </div>

        {/* TOP 3 特殊展示區域 */}
        {rankingData.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">🏆 TOP 3 夥伴</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {rankingData.slice(0, 3).map((partner, index) => (
                <div
                  key={partner.id}
                  className={`relative p-6 rounded-2xl shadow-lg transform transition-all duration-300 hover:scale-105 cursor-pointer ${
                    index === 0 ? 'order-2 md:order-1' : index === 1 ? 'order-1 md:order-2' : 'order-3'
                  }`}
                  style={{
                    background: index === 0 
                      ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)'
                      : index === 1
                      ? 'linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 100%)'
                      : 'linear-gradient(135deg, #CD7F32 0%, #B8860B 100%)'
                  }}
                  onClick={() => handlePartnerClick(partner.id)}
                >
                  {/* 排名標誌 */}
                  <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                    {getRankIcon(partner.rank)}
                  </div>
                  
                  {/* 夥伴資訊 */}
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {partner.coverImage ? (
                        <Image
                          src={partner.coverImage}
                          alt={partner.name}
                          width={80}
                          height={80}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-gray-500">{partner.name[0]}</span>
                      )}
                    </div>
                    
                    <h3 className="text-lg font-bold text-white mb-2">{partner.name}</h3>
                    <div className="flex justify-center gap-1 mb-3">
                      {partner.games.slice(0, 3).map((game, i) => (
                        <span key={i} className="px-2 py-1 bg-white/20 rounded text-xs text-white">
                          {game}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 text-white">
                      <FaBolt className="text-yellow-300" />
                      <span className="font-semibold">
                        {Math.round(partner.totalMinutes / 60)} 小時
                      </span>
                    </div>
                    
                    {/* 狀態標籤 */}
                    <div className="flex justify-center gap-2 mt-3">
                      {partner.isAvailableNow && (
                        <span className="px-2 py-1 bg-green-500/80 text-white text-xs rounded">
                          現在有空
                        </span>
                      )}
                      {partner.isRankBooster && (
                        <span className="px-2 py-1 bg-orange-500/80 text-white text-xs rounded">
                          上分高手
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4-10 名橫向列表 */}
        {rankingData.length > 3 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4 text-center">🥇 第 4-10 名</h2>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {rankingData.slice(3, 10).map((partner) => (
                  <div
                    key={partner.id}
                    className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-600/50 transition-all duration-200 cursor-pointer border border-gray-600/30"
                    onClick={() => handlePartnerClick(partner.id)}
                  >
                    <div className="flex items-center space-x-3">
                      {/* 排名 */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                          <span className="text-white font-bold text-sm">{partner.rank}</span>
                        </div>
                      </div>
                      
                      {/* 頭像 */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-600 flex items-center justify-center">
                          {partner.coverImage ? (
                            <Image
                              src={partner.coverImage}
                              alt={partner.name}
                              width={48}
                              height={48}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <span className="text-lg font-bold text-gray-400">{partner.name[0]}</span>
                          )}
                        </div>
                      </div>
                      
                      {/* 資訊 */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm truncate">{partner.name}</h3>
                        <div className="flex items-center gap-1 mt-1">
                          <FaBolt className="text-yellow-400 text-xs" />
                          <span className="text-gray-300 text-xs">
                            {Math.round(partner.totalMinutes / 60)}h
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {partner.games.slice(0, 1).map((game, i) => (
                            <span key={i} className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                              {game}
                            </span>
                          ))}
                          {partner.games.length > 1 && (
                            <span className="px-1.5 py-0.5 bg-gray-600/50 text-gray-400 text-xs rounded">
                              +{partner.games.length - 1}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* 狀態標籤 */}
                      <div className="flex-shrink-0">
                        <div className="flex flex-col gap-1">
                          {partner.isAvailableNow && (
                            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-300 text-xs rounded">
                              有空
                            </span>
                          )}
                          {partner.isRankBooster && (
                            <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-300 text-xs rounded">
                              上分
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 完整排行榜 */}
        {rankingData.length > 3 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6 text-center">📊 完整排行榜</h2>
            <div className="bg-gray-800/50 rounded-lg shadow-lg overflow-hidden border border-gray-600/30">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        排名
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        夥伴
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        遊戲
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        總時長
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        狀態
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-800/30 divide-y divide-gray-700/50">
                    {rankingData.slice(10).map((partner) => (
                      <tr 
                        key={partner.id} 
                        className="hover:bg-gray-700/30 cursor-pointer transition-colors"
                        onClick={() => handlePartnerClick(partner.id)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-white">{partner.rank}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-600 flex items-center justify-center mr-3">
                              {partner.coverImage ? (
                                <Image
                                  src={partner.coverImage}
                                  alt={partner.name}
                                  width={40}
                                  height={40}
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <span className="text-sm font-bold text-gray-400">{partner.name[0]}</span>
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{partner.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-wrap gap-1">
                            {partner.games.slice(0, 2).map((game, i) => (
                              <span key={i} className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                                {game}
                              </span>
                            ))}
                            {partner.games.length > 2 && (
                              <span className="px-2 py-1 bg-gray-600/50 text-gray-400 text-xs rounded">
                                +{partner.games.length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <FaBolt className="text-yellow-400 mr-1" />
                            <span className="text-sm text-white">
                              {Math.round(partner.totalMinutes / 60)} 小時
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-1">
                            {partner.isAvailableNow && (
                              <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded">
                                有空
                              </span>
                            )}
                            {partner.isRankBooster && (
                              <span className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded">
                                上分
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 空狀態 */}
        {rankingData.length === 0 && !loading && !error && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h2 className="text-xl font-bold text-gray-600 mb-2">排行榜暫時為空</h2>
            <p className="text-gray-500">目前還沒有夥伴的預約資料</p>
          </div>
        )}
      </div>
    </div>
  )
}