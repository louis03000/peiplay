'use client'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

export default function TwoFactorSetup() {
  const t = useTranslations()
  const [step, setStep] = useState<'initial' | 'qr' | 'verify'>('initial')
  const [qrCode, setQrCode] = useState<string>('')
  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSetup = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/2fa/setup', {
        method: 'POST'
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error)
      
      setQrCode(data.qrCode)
      setStep('qr')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error)
      
      setStep('verify')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'initial') {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('2fa.setup')}</h3>
        <button
          onClick={handleSetup}
          disabled={loading}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? t('common.loading') : t('2fa.setup')}
        </button>
        {error && (
          <div className="text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}
      </div>
    )
  }

  if (step === 'qr') {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">{t('2fa.scan')}</h3>
        <div className="flex justify-center">
          {qrCode && (
            <Image
              src={qrCode}
              alt="2FA QR Code"
              width={200}
              height={200}
              className="rounded-lg"
            />
          )}
        </div>
        <div className="space-y-2">
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={t('2fa.enter')}
            className="w-full px-3 py-2 border rounded-md"
          />
          <button
            onClick={handleVerify}
            disabled={loading || !token}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('2fa.verify')}
          </button>
        </div>
        {error && (
          <div className="text-red-600 bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="text-green-600 bg-green-50 p-4 rounded-md">
      {t('2fa.enabled')}
    </div>
  )
} 