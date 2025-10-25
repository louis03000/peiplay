#!/usr/bin/env node

/**
 * 檢查資料庫遷移狀態
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function checkMigrations() {
  console.log('🔍 檢查資料庫遷移狀態...')
  
  try {
    // 1. 檢查 Prisma schema 文件
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma')
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Prisma schema 文件不存在')
      return false
    }
    console.log('✅ Prisma schema 文件存在')
    
    // 2. 檢查遷移文件
    const migrationsPath = path.join(process.cwd(), 'prisma', 'migrations')
    if (!fs.existsSync(migrationsPath)) {
      console.log('⚠️ 遷移目錄不存在，可能需要初始化')
      return false
    }
    
    const migrationFiles = fs.readdirSync(migrationsPath)
    console.log(`✅ 找到 ${migrationFiles.length} 個遷移文件`)
    
    // 3. 檢查資料庫狀態
    console.log('\n📊 檢查資料庫狀態...')
    try {
      const status = execSync('npx prisma migrate status', { 
        encoding: 'utf8',
        stdio: 'pipe'
      })
      console.log('✅ 遷移狀態:', status.trim())
    } catch (error) {
      console.error('❌ 遷移狀態檢查失敗:', error.message)
      return false
    }
    
    // 4. 檢查資料庫連接
    console.log('\n🔌 檢查資料庫連接...')
    try {
      execSync('npx prisma db pull --print', { 
        encoding: 'utf8',
        stdio: 'pipe'
      })
      console.log('✅ 資料庫連接正常')
    } catch (error) {
      console.error('❌ 資料庫連接失敗:', error.message)
      return false
    }
    
    return true
    
  } catch (error) {
    console.error('❌ 檢查過程發生錯誤:', error.message)
    return false
  }
}

function suggestFixes() {
  console.log('\n🔧 修復建議:')
  console.log('1. 如果遷移目錄不存在:')
  console.log('   npx prisma migrate dev --name init')
  console.log('')
  console.log('2. 如果資料庫 schema 不同步:')
  console.log('   npx prisma db push')
  console.log('')
  console.log('3. 如果遷移狀態有問題:')
  console.log('   npx prisma migrate reset')
  console.log('')
  console.log('4. 如果環境變數未設定:')
  console.log('   在 Vercel 設定中添加 DATABASE_URL')
}

// 執行檢查
if (checkMigrations()) {
  console.log('\n🎉 資料庫遷移檢查完成 - 狀態正常')
} else {
  console.log('\n⚠️ 資料庫遷移檢查完成 - 需要修復')
  suggestFixes()
}
