'use client'

import React from 'react'

interface PartnerPageLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  maxWidth?: '4xl' | '5xl' | '6xl' | '7xl'
}

const PartnerPageLayout: React.FC<PartnerPageLayoutProps> = ({
  title,
  subtitle,
  children,
  maxWidth = '6xl'
}) => {
  const maxWidthClass = {
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl'
  }[maxWidth]

  return (
    <div className="min-h-screen bg-[#F8F9FB]">
      <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 pt-4 sm:pt-8">
        {/* 頁面標題 */}
        <div className="text-center mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm sm:text-base text-gray-600">
              {subtitle}
            </p>
          )}
        </div>

        {/* 內容區域 */}
        <div className={`${maxWidthClass} mx-auto`}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default PartnerPageLayout

