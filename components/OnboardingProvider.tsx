'use client'

import { useState, useEffect } from 'react'
import OnboardingModal from './OnboardingModal'

export default function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    // 檢查是否應該顯示 onboarding
    const checkOnboarding = () => {
      if (typeof window === 'undefined') return
      
      const onboardingDone = localStorage.getItem('peiplay_onboarding_done')
      if (onboardingDone !== 'true') {
        // 延遲一點顯示，確保頁面已載入
        setTimeout(() => {
          setShowOnboarding(true)
        }, 500)
      }
    }

    checkOnboarding()

    // 監聽手動打開 onboarding 的事件
    const handleOpenOnboarding = () => {
      setShowOnboarding(true)
    }

    window.addEventListener('open-onboarding', handleOpenOnboarding)

    return () => {
      window.removeEventListener('open-onboarding', handleOpenOnboarding)
    }
  }, [])

  const handleClose = () => {
    setShowOnboarding(false)
  }

  const handleComplete = () => {
    setShowOnboarding(false)
  }

  return (
    <>
      {children}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={handleClose}
        onComplete={handleComplete}
      />
    </>
  )
}
