import React from 'react'

interface InfoCardProps {
  children: React.ReactNode
  className?: string
  padding?: 'sm' | 'md' | 'lg'
  noShadow?: boolean
  bgColor?: 'white' | 'gray'
}

export default function InfoCard({
  children,
  className = '',
  padding = 'md',
  noShadow = false,
  bgColor = 'white'
}: InfoCardProps) {
  const paddingClass = {
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8'
  }[padding]

  const bgColorClass = {
    white: 'bg-white',
    gray: 'bg-gray-50'
  }[bgColor]

  return (
    <div
      className={`
        ${bgColorClass} rounded-2xl
        ${noShadow ? '' : 'shadow-lg'}
        ${paddingClass}
        ${className}
      `.trim()}
    >
      {children}
    </div>
  )
}

