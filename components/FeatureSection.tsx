'use client'

import { useState, useEffect } from 'react'

interface Feature {
  id: string
  icon: string
  title: string
  description: string
  gradient: string
  stats?: {
    value: string
    label: string
  }
}

interface FeatureSectionProps {
  title: string
  subtitle: string
  features: Feature[]
  backgroundColor?: string
}

export default function FeatureSection({ 
  title, 
  subtitle, 
  features, 
  backgroundColor = 'white' 
}: FeatureSectionProps) {
  const [visibleCards, setVisibleCards] = useState<number[]>([])

  useEffect(() => {
    // 漸進式顯示動畫
    features.forEach((_, index) => {
      setTimeout(() => {
        setVisibleCards(prev => [...prev, index])
      }, index * 200)
    })
  }, [features])

  return (
    <div className="py-32 px-6 relative" style={{ backgroundColor }}>
      {/* 背景裝飾 */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-5"></div>
      
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-24">
          <h2 className="text-5xl sm:text-6xl font-bold mb-8" style={{color: '#333140'}}>
            {title}
          </h2>
          <div className="w-32 h-2 mx-auto mb-8 rounded-full" style={{
            background: 'linear-gradient(90deg, #1A73E8, #5C7AD6, #00BFA5)'
          }}></div>
          <p className="text-2xl max-w-4xl mx-auto font-light" style={{color: '#333140', opacity: 0.8}}>
            {subtitle}
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {features.map((feature, index) => (
            <div
              key={feature.id}
              className={`text-center p-10 rounded-3xl transition-all duration-700 hover:shadow-2xl hover:-translate-y-4 transform ${
                visibleCards.includes(index) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{backgroundColor: 'white'}}
            >
              {/* 圖標容器 */}
              <div 
                className="w-24 h-24 mx-auto mb-8 rounded-3xl flex items-center justify-center group-hover:scale-125 group-hover:rotate-12 transition-all duration-500"
                style={{background: feature.gradient}}
              >
                <span className="text-4xl">{feature.icon}</span>
              </div>

              {/* 標題 */}
              <h3 className="text-2xl font-bold mb-6" style={{color: '#333140'}}>
                {feature.title}
              </h3>

              {/* 描述 */}
              <p className="leading-relaxed text-lg mb-6" style={{color: '#333140', opacity: 0.8}}>
                {feature.description}
              </p>

              {/* 統計數據 */}
              {feature.stats && (
                <div className="mt-6 p-4 rounded-2xl" style={{backgroundColor: '#E4E7EB'}}>
                  <div className="text-2xl font-bold mb-1" style={{color: '#1A73E8'}}>
                    {feature.stats.value}
                  </div>
                  <div className="text-sm" style={{color: '#333140', opacity: 0.7}}>
                    {feature.stats.label}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
