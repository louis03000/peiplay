'use client'

import { useState, useEffect } from 'react'

interface Stat {
  id: string
  value: string
  label: string
  color: string
  icon?: string
}

interface StatsSectionProps {
  stats: Stat[]
  backgroundColor?: string
}

export default function StatsSection({ stats, backgroundColor = 'white' }: StatsSectionProps) {
  const [countedStats, setCountedStats] = useState<Stat[]>(stats.map(stat => ({
    ...stat,
    value: '0'
  })))

  useEffect(() => {
    // 數字動畫效果
    const animateNumbers = () => {
      stats.forEach((stat, index) => {
        const numericValue = stat.value.replace(/[^\d]/g, '')
        const suffix = stat.value.replace(/[\d]/g, '')
        
        if (numericValue) {
          const targetNumber = parseInt(numericValue)
          const duration = 2000
          const steps = 60
          const stepValue = targetNumber / steps
          let currentValue = 0

          const timer = setInterval(() => {
            currentValue += stepValue
            if (currentValue >= targetNumber) {
              currentValue = targetNumber
              clearInterval(timer)
            }

            setCountedStats(prev => prev.map((s, i) => 
              i === index 
                ? { ...s, value: Math.floor(currentValue).toString() + suffix }
                : s
            ))
          }, duration / steps)
        }
      })
    }

    // 延遲啟動動畫
    const timer = setTimeout(animateNumbers, 500)
    return () => clearTimeout(timer)
  }, [stats])

  return (
    <div className="py-24 px-6" style={{ backgroundColor }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-16 text-center">
          {countedStats.map((stat, index) => (
            <div key={stat.id} className="group">
              {stat.icon && (
                <div className="text-6xl mb-4 group-hover:scale-125 transition-transform duration-500">
                  {stat.icon}
                </div>
              )}
              <div 
                className="text-6xl sm:text-7xl font-bold mb-6 group-hover:scale-125 transition-transform duration-500"
                style={{ color: stat.color }}
              >
                {stat.value}
              </div>
              <div className="text-xl font-medium" style={{color: '#333140', opacity: 0.8}}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
