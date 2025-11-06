'use client'

import React from 'react'

interface StatBoxProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  iconBgColor?: 'green' | 'blue' | 'purple' | 'yellow' | 'indigo'
  subtitle?: string
  className?: string
}

export default function StatBox({
  label,
  value,
  icon,
  iconBgColor = 'blue',
  subtitle,
  className = ''
}: StatBoxProps) {
  const iconBgColorClass = {
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    purple: 'bg-purple-100 text-purple-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    indigo: 'bg-indigo-100 text-indigo-600'
  }[iconBgColor]

  return (
    <div className={`bg-white rounded-2xl shadow-lg p-4 sm:p-6 ${className}`}>
      <div className="flex items-center">
        {icon && (
          <div className={`p-2 sm:p-3 rounded-lg ${iconBgColorClass}`}>
            {icon}
          </div>
        )}
        <div className={icon ? 'ml-4' : ''}>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  )
}

