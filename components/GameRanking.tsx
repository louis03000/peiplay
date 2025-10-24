'use client'

import { useState, useEffect } from 'react'

interface Game {
  name: string
  playerCount: number
  icon: string
}

interface GameRankingProps {
  games: Game[]
  backgroundColor?: string
}

export default function GameRanking({ games, backgroundColor = '#E4E7EB' }: GameRankingProps) {
  const [visibleGames, setVisibleGames] = useState<number[]>([])

  useEffect(() => {
    // 漸進式顯示動畫
    games.forEach((_, index) => {
      setTimeout(() => {
        setVisibleGames(prev => [...prev, index])
      }, index * 150)
    })
  }, [games])

  return (
    <div className="py-32 px-6" style={{ backgroundColor }}>
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-24">
          <h2 className="text-5xl sm:text-6xl font-bold mb-8" style={{color: '#333140'}}>
            熱門遊戲
          </h2>
          <div className="w-32 h-2 mx-auto mb-8 rounded-full" style={{
            background: 'linear-gradient(90deg, #1A73E8, #5C7AD6, #00BFA5)'
          }}></div>
          <p className="text-2xl max-w-4xl mx-auto font-light" style={{color: '#333140', opacity: 0.8}}>
            看看大家都在玩什麼遊戲
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {games.map((game, index) => (
            <div 
              key={game.name}
              className={`group text-center p-10 rounded-3xl transition-all duration-700 hover:shadow-2xl hover:-translate-y-4 transform ${
                visibleGames.includes(index) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`} 
              style={{backgroundColor: 'white'}}
            >
              {/* 排名徽章 */}
              <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
                   style={{
                     background: index < 3 
                       ? index === 0 ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                       : index === 1 ? 'linear-gradient(135deg, #C0C0C0, #A0A0A0)'
                       : 'linear-gradient(135deg, #CD7F32, #B8860B)'
                       : 'linear-gradient(135deg, #1A73E8, #5C7AD6)'
                   }}>
                {index + 1}
              </div>

              {/* 遊戲圖標 */}
              <div className="text-8xl mb-8 group-hover:scale-125 group-hover:rotate-12 transition-transform duration-500">
                {game.icon}
              </div>

              {/* 遊戲名稱 */}
              <h3 className="text-2xl font-bold mb-6" style={{color: '#333140'}}>
                {game.name}
              </h3>

              {/* 玩家數量 */}
              <div className="text-xl font-medium" style={{color: '#333140', opacity: 0.8}}>
                {game.playerCount.toLocaleString()} 玩家
              </div>

              {/* 進度條 */}
              <div className="mt-6">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-1000"
                    style={{
                      background: 'linear-gradient(90deg, #1A73E8, #5C7AD6)',
                      width: `${(game.playerCount / games[0].playerCount) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
