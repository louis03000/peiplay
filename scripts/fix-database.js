#!/usr/bin/env node

/**
 * 資料庫修復腳本
 * 用於診斷和修復 PeiPlay 的資料庫連接問題
 */

const { PrismaClient } = require('@prisma/client')

async function diagnoseDatabase() {
  console.log('🔍 開始資料庫診斷...')
  
  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn', 'info']
  })
  
  try {
    // 1. 檢查環境變數
    console.log('\n📊 環境變數檢查:')
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已設定' : '未設定')
    console.log('NODE_ENV:', process.env.NODE_ENV)
    
    // 2. 測試連接
    console.log('\n🔌 連接測試:')
    await prisma.$connect()
    console.log('✅ 資料庫連接成功')
    
    // 3. 測試基本查詢
    console.log('\n📋 基本查詢測試:')
    const userCount = await prisma.user.count()
    console.log(`✅ 用戶表查詢成功，共 ${userCount} 筆記錄`)
    
    const partnerCount = await prisma.partner.count()
    console.log(`✅ 夥伴表查詢成功，共 ${partnerCount} 筆記錄`)
    
    const customerCount = await prisma.customer.count()
    console.log(`✅ 客戶表查詢成功，共 ${customerCount} 筆記錄`)
    
    // 4. 測試關聯查詢
    console.log('\n🔗 關聯查詢測試:')
    const usersWithPartners = await prisma.user.findMany({
      where: { partner: { isNot: null } },
      include: { partner: true }
    })
    console.log(`✅ 用戶-夥伴關聯查詢成功，共 ${usersWithPartners.length} 筆`)
    
    // 5. 測試寫入操作
    console.log('\n✍️ 寫入操作測試:')
    const testUser = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        password: 'test-password',
        name: 'Test User'
      }
    })
    console.log(`✅ 測試用戶創建成功，ID: ${testUser.id}`)
    
    // 清理測試數據
    await prisma.user.delete({
      where: { id: testUser.id }
    })
    console.log('✅ 測試數據清理完成')
    
    console.log('\n🎉 資料庫診斷完成 - 所有測試通過！')
    
  } catch (error) {
    console.error('\n❌ 資料庫診斷失敗:')
    console.error('錯誤類型:', error.constructor.name)
    console.error('錯誤訊息:', error.message)
    
    if (error.code) {
      console.error('錯誤代碼:', error.code)
    }
    
    // 提供修復建議
    console.log('\n🔧 修復建議:')
    
    if (error.message.includes('connect')) {
      console.log('1. 檢查 DATABASE_URL 是否正確')
      console.log('2. 確認資料庫服務是否運行')
      console.log('3. 檢查網路連接')
    }
    
    if (error.message.includes('relation') || error.message.includes('table')) {
      console.log('1. 執行 prisma db push')
      console.log('2. 或執行 prisma migrate deploy')
    }
    
    if (error.message.includes('permission') || error.message.includes('access')) {
      console.log('1. 檢查資料庫用戶權限')
      console.log('2. 確認連接字串中的用戶名和密碼')
    }
    
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 執行診斷
diagnoseDatabase()
  .then(() => {
    console.log('\n✅ 診斷完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 診斷過程發生錯誤:', error)
    process.exit(1)
  })
