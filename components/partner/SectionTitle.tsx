'use client'

import React from 'react'

interface SectionTitleProps {
  title: string
  subtitle?: string
  className?: string
}

export default function SectionTitle({
  title,
  subtitle,
  className = ''
}: SectionTitleProps) {
  return (
    <div className={`mb-4 sm:mb-6 ${className}`}>
      <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-gray-600">
          {subtitle}
        </p>
      )}
    </div>
  )
}

