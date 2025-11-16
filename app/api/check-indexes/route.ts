import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import { createErrorResponse } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await db.query(async (client) => {
      // 檢查關鍵索引是否存在
      const indexes = await client.$queryRaw<Array<{
        schemaname: string
        tablename: string
        indexname: string
        indexdef: string
      }>>`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('Booking', 'Schedule', 'WithdrawalRequest', 'Partner', 'Customer')
          AND (
            indexname LIKE '%partnerId%' 
            OR indexname LIKE '%scheduleId%'
            OR indexname LIKE '%status%'
            OR indexname LIKE '%userId%'
            OR indexname LIKE '%date%'
          )
        ORDER BY tablename, indexname
      `

      // 檢查索引使用情況
      const indexUsage = await client.$queryRaw<Array<{
        schemaname: string
        tablename: string
        indexname: string
        idx_scan: bigint
        idx_tup_read: bigint
        idx_tup_fetch: bigint
      }>>`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('Booking', 'Schedule', 'WithdrawalRequest', 'Partner', 'Customer')
        ORDER BY idx_scan DESC
        LIMIT 20
      `

      // 檢查關鍵索引是否存在
      const requiredIndexes = [
        'Booking_scheduleId_status_idx',
        'Schedule_partnerId_date_idx',
        'WithdrawalRequest_partnerId_status_idx',
        'Partner_status_idx',
        'Partner_userId_idx',
      ]

      const existingIndexNames = indexes.map(idx => idx.indexname)
      const missingIndexes = requiredIndexes.filter(name => 
        !existingIndexNames.some(existing => existing.includes(name.split('_')[1]))
      )

      return {
        indexes,
        indexUsage,
        missingIndexes,
        summary: {
          totalIndexes: indexes.length,
          missingCount: missingIndexes.length,
          indexesWithUsage: indexUsage.filter(usage => Number(usage.idx_scan) > 0).length,
        }
      }
    }, 'check-indexes')

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, 'check-indexes')
  }
}

