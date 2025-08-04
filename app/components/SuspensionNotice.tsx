'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface SuspensionStatus {
  isSuspended: boolean
  suspensionReason: string | null
  suspensionEndsAt: string | null
  remainingDays: number
}

export default function SuspensionNotice() {
  const { data: session } = useSession()
  const [suspensionStatus, setSuspensionStatus] = useState<SuspensionStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    const checkSuspensionStatus = async () => {
      try {
        const res = await fetch('/api/user/suspension-status')
        if (res.ok) {
          const data = await res.json()
          setSuspensionStatus(data)
        }
      } catch (error) {
        console.error('Error checking suspension status:', error)
      } finally {
        setLoading(false)
      }
    }

    checkSuspensionStatus()
  }, [session])

  if (loading || !suspensionStatus?.isSuspended) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white p-4 shadow-lg" style={{ marginTop: '64px' }}>
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex-1">
          <div className="font-semibold text-lg mb-1">
            ⚠️ 您的帳號已被停權
          </div>
          <div className="text-sm">
            停權原因: {suspensionStatus.suspensionReason || '未提供'}
          </div>
          <div className="text-sm">
            剩餘停權時間: {suspensionStatus.remainingDays} 天
          </div>
        </div>
        <div className="text-sm text-red-100">
          停權期間無法使用平台功能
        </div>
      </div>
    </div>
  )
} 