/**
 * 應用程式啟動初始化
 * 在應用啟動時執行一次，預熱資料庫連接
 */

import { warmupConnection, startConnectionMonitoring } from './db-resilience'

let isInitialized = false

export async function initializeApp() {
  if (isInitialized) {
    console.log('⚠️ App already initialized, skipping...')
    return
  }

  console.log('🚀 Initializing application...')

  try {
    // 預熱資料庫連接
    await warmupConnection()

    // 在生產環境啟動連接監控（每分鐘檢查一次）
    if (process.env.NODE_ENV === 'production') {
      startConnectionMonitoring(60000)
      console.log('✅ Connection monitoring started')
    }

    isInitialized = true
    console.log('✅ Application initialized successfully')
  } catch (error) {
    console.error('❌ Application initialization failed:', error)
    // 不拋出錯誤，讓應用繼續運行
  }
}

// 在 serverless 環境中，這會在每個 cold start 時執行
if (typeof window === 'undefined') {
  // 僅在伺服器端執行
  initializeApp().catch(console.error)
}

