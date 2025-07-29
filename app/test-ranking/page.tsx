'use client'

import { useState } from 'react'

export default function TestRankingPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const createTestData = async () => {
    setLoading(true)
    setMessage(null)
    
    try {
      const response = await fetch('/api/test-ranking', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setMessage(`✅ ${data.message}\n\n${JSON.stringify(data.data, null, 2)}`)
      } else {
        setMessage(`❌ ${data.error}`)
      }
    } catch (error) {
      setMessage(`❌ 創建測試資料失敗: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pt-20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">排行榜測試資料</h1>
          
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">說明</h2>
            <p className="text-gray-600 mb-4">
              此頁面用於創建排行榜測試資料。將會創建：
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-4 space-y-2">
              <li>2 個測試夥伴</li>
              <li>1 個測試客戶</li>
              <li>多個已完成的預約記錄</li>
              <li>不同時長的預約以展示排行榜功能</li>
            </ul>
            
            <button
              onClick={createTestData}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              {loading ? '創建中...' : '創建排行榜測試資料'}
            </button>
          </div>

          {message && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4">結果</h2>
              <pre className="bg-gray-100 p-4 rounded-lg overflow-auto text-sm">
                {message}
              </pre>
            </div>
          )}

          <div className="mt-6 text-center">
            <a
              href="/ranking"
              className="inline-block bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 font-semibold"
            >
              查看排行榜
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}