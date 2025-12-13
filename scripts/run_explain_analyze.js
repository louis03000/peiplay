#!/usr/bin/env node
/**
 * 執行 EXPLAIN ANALYZE 診斷腳本 (Node.js 版本)
 * 如果沒有安裝 psql，可以使用這個腳本
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

async function runExplainAnalyze() {
  try {
    console.log('🔍 開始執行 EXPLAIN ANALYZE 診斷...\n')

    // 讀取 SQL 腳本
    const sqlFile = path.join(__dirname, 'explain_analyze_queries.sql')
    const sql = fs.readFileSync(sqlFile, 'utf-8')

    // 分割 SQL 語句（以分號分隔）
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    // 執行每個查詢
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      // 跳過註解和空行
      if (statement.startsWith('--') || statement.length === 0) {
        continue
      }

      // 如果是 EXPLAIN ANALYZE 查詢
      if (statement.toUpperCase().includes('EXPLAIN ANALYZE')) {
        console.log(`\n${'='.repeat(80)}`)
        console.log(`查詢 ${i + 1}:`)
        console.log(`${'='.repeat(80)}\n`)
        
        try {
          const result = await prisma.$queryRawUnsafe(statement)
          console.log(JSON.stringify(result, null, 2))
        } catch (error) {
          console.error(`❌ 查詢失敗:`, error.message)
        }
      } else {
        // 其他查詢（SELECT 統計資訊等）
        try {
          const result = await prisma.$queryRawUnsafe(statement)
          if (Array.isArray(result) && result.length > 0) {
            console.log(`\n${'='.repeat(80)}`)
            console.log(`查詢 ${i + 1} 結果:`)
            console.log(`${'='.repeat(80)}`)
            console.table(result)
          }
        } catch (error) {
          // 忽略錯誤（可能是 pg_stat_statements 未啟用等）
          if (!error.message.includes('does not exist')) {
            console.error(`⚠️  查詢警告:`, error.message)
          }
        }
      }
    }

    console.log(`\n${'='.repeat(80)}`)
    console.log('✅ 診斷完成！')
    console.log(`\n📊 重點檢查項目：`)
    console.log('  - 是否有 "Seq Scan"（全表掃描）')
    console.log('  - "Rows Removed by Filter" 是否很大')
    console.log('  - 是否使用了索引（"Index Scan" 或 "Index Only Scan"）')
    console.log('')

  } catch (error) {
    console.error('❌ 執行失敗:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 執行
runExplainAnalyze()

