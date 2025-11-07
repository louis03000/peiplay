/**
 * 資料庫彈性處理測試腳本
 * 用於測試重試機制、斷路器和錯誤處理
 * 
 * 執行方式：
 * npx ts-node scripts/test-db-resilience.ts
 */

import { db } from '../lib/db-resilience'
import { prisma } from '../lib/prisma'

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function testHealthCheck() {
  log('\n=== 測試 1: 健康檢查 ===', 'blue')
  
  try {
    const health = await db.healthCheck()
    log(`✅ 資料庫狀態: ${health.status}`, 'green')
    log(`   響應時間: ${health.responseTime}ms`, 'green')
    log(`   斷路器狀態: ${health.circuitBreaker.state}`, 'green')
  } catch (error) {
    log(`❌ 健康檢查失敗: ${error}`, 'red')
  }
}

async function testSimpleQuery() {
  log('\n=== 測試 2: 簡單查詢（帶重試） ===', 'blue')
  
  try {
    const startTime = Date.now()
    
    const result = await db.query(async (prisma) => {
      return await prisma.user.count()
    }, 'Count users')
    
    const duration = Date.now() - startTime
    log(`✅ 查詢成功: 找到 ${result} 個用戶`, 'green')
    log(`   耗時: ${duration}ms`, 'green')
  } catch (error: any) {
    log(`❌ 查詢失敗: ${error.message}`, 'red')
  }
}

async function testComplexQuery() {
  log('\n=== 測試 3: 複雜查詢（並行） ===', 'blue')
  
  try {
    const startTime = Date.now()
    
    const result = await db.query(async (prisma) => {
      const [userCount, partnerCount, bookingCount] = await Promise.all([
        prisma.user.count(),
        prisma.partner.count(),
        prisma.booking.count(),
      ])
      
      return { userCount, partnerCount, bookingCount }
    }, 'Get statistics')
    
    const duration = Date.now() - startTime
    log(`✅ 查詢成功:`, 'green')
    log(`   用戶: ${result.userCount}`, 'green')
    log(`   夥伴: ${result.partnerCount}`, 'green')
    log(`   預約: ${result.bookingCount}`, 'green')
    log(`   耗時: ${duration}ms`, 'green')
  } catch (error: any) {
    log(`❌ 查詢失敗: ${error.message}`, 'red')
  }
}

async function testRetryMechanism() {
  log('\n=== 測試 4: 重試機制（模擬失敗） ===', 'blue')
  
  let attemptCount = 0
  
  try {
    await db.query(async (prisma) => {
      attemptCount++
      log(`   嘗試 #${attemptCount}`, 'yellow')
      
      // 模擬前兩次失敗
      if (attemptCount < 3) {
        throw new Error('ETIMEDOUT')
      }
      
      return await prisma.user.count()
    }, 'Retry test')
    
    log(`✅ 重試成功！總共嘗試 ${attemptCount} 次`, 'green')
  } catch (error: any) {
    log(`❌ 重試失敗: ${error.message}`, 'red')
  }
}

async function testCircuitBreakerStatus() {
  log('\n=== 測試 5: 斷路器狀態 ===', 'blue')
  
  const status = db.getCircuitBreakerStatus()
  
  log(`✅ 斷路器狀態: ${status.state}`, 'green')
  log(`   失敗次數: ${status.failureCount}`, 'green')
  log(`   成功次數: ${status.successCount}`, 'green')
  log(`   最後失敗時間: ${status.lastFailureTime || 'N/A'}`, 'green')
}

async function testConnectionPool() {
  log('\n=== 測試 6: 連接池（並發請求） ===', 'blue')
  
  const concurrentRequests = 5
  log(`   發送 ${concurrentRequests} 個並發請求...`, 'yellow')
  
  try {
    const startTime = Date.now()
    
    const promises = Array.from({ length: concurrentRequests }, (_, i) =>
      db.query(async (prisma) => {
        log(`   請求 #${i + 1} 開始`, 'yellow')
        const result = await prisma.user.count()
        log(`   請求 #${i + 1} 完成`, 'green')
        return result
      }, `Concurrent request ${i + 1}`)
    )
    
    await Promise.all(promises)
    
    const duration = Date.now() - startTime
    log(`✅ 所有並發請求成功！總耗時: ${duration}ms`, 'green')
  } catch (error: any) {
    log(`❌ 並發請求失敗: ${error.message}`, 'red')
  }
}

async function testErrorHandling() {
  log('\n=== 測試 7: 錯誤處理 ===', 'blue')
  
  // 測試不可重試的錯誤
  try {
    await db.query(async (prisma) => {
      // 模擬驗證錯誤（不應重試）
      throw new Error('Validation error')
    }, 'Error handling test')
    
    log(`❌ 應該拋出錯誤但沒有`, 'red')
  } catch (error: any) {
    log(`✅ 正確捕獲錯誤: ${error.message}`, 'green')
  }
}

async function runAllTests() {
  log('🚀 開始資料庫彈性處理測試...', 'blue')
  log('=' .repeat(50), 'blue')
  
  try {
    await testHealthCheck()
    await testSimpleQuery()
    await testComplexQuery()
    await testRetryMechanism()
    await testCircuitBreakerStatus()
    await testConnectionPool()
    await testErrorHandling()
    
    log('\n' + '='.repeat(50), 'blue')
    log('✅ 所有測試完成！', 'green')
    
    // 最終健康檢查
    const finalHealth = await db.healthCheck()
    log(`\n📊 最終狀態: ${finalHealth.status}`, 'blue')
    log(`   平均響應時間: ${finalHealth.responseTime}ms`, 'blue')
    
  } catch (error: any) {
    log(`\n❌ 測試過程中發生錯誤: ${error.message}`, 'red')
  } finally {
    // 斷開連接
    await prisma.$disconnect()
    log('\n👋 資料庫連接已關閉', 'blue')
  }
}

// 執行測試
runAllTests().catch((error) => {
  log(`Fatal error: ${error}`, 'red')
  process.exit(1)
})

