import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db-resilience';
import { createErrorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/slow-queries
 * 獲取慢查詢統計資訊（需要管理員權限）
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type') || 'slowest'; // slowest, most_called, total_time

    const result = await db.query(async (client) => {
      // 檢查 pg_stat_statements 擴展是否可用
      const extensionCheck = await (client as any).$queryRaw`
        SELECT EXISTS(
          SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) as exists;
      `;

      if (!extensionCheck[0]?.exists) {
        return {
          error: 'pg_stat_statements 擴展未啟用',
          message: '請執行: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;',
        };
      }

      let query: string;
      switch (type) {
        case 'most_called':
          // 執行次數最多的查詢
          query = `
            SELECT 
              query,
              calls,
              total_exec_time,
              mean_exec_time,
              max_exec_time,
              rows,
              round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 2) as hit_percent
            FROM pg_stat_statements
            WHERE query NOT LIKE '%pg_stat_statements%'
              AND query NOT LIKE '%pg_stat_activity%'
            ORDER BY calls DESC
            LIMIT ${limit};
          `;
          break;
        case 'total_time':
          // 總執行時間最長的查詢
          query = `
            SELECT 
              query,
              calls,
              total_exec_time,
              mean_exec_time,
              max_exec_time,
              rows,
              round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 2) as hit_percent
            FROM pg_stat_statements
            WHERE query NOT LIKE '%pg_stat_statements%'
              AND query NOT LIKE '%pg_stat_activity%'
            ORDER BY total_exec_time DESC
            LIMIT ${limit};
          `;
          break;
        case 'slowest':
        default:
          // 平均執行時間最長的查詢
          query = `
            SELECT 
              query,
              calls,
              total_exec_time,
              mean_exec_time,
              max_exec_time,
              rows,
              round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 2) as hit_percent
            FROM pg_stat_statements
            WHERE query NOT LIKE '%pg_stat_statements%'
              AND query NOT LIKE '%pg_stat_activity%'
            ORDER BY mean_exec_time DESC
            LIMIT ${limit};
          `;
          break;
      }

      const queries = await (client as any).$queryRawUnsafe(query);

      // 獲取當前正在執行的慢查詢
      const activeSlowQueries = await (client as any).$queryRaw`
        SELECT 
          pid,
          now() - pg_stat_activity.query_start AS duration,
          state,
          wait_event_type,
          wait_event,
          left(query, 200) as query_preview,
          application_name,
          client_addr
        FROM pg_stat_activity
        WHERE state <> 'idle'
          AND now() - pg_stat_activity.query_start > interval '1 second'
          AND query NOT LIKE '%pg_stat_activity%'
        ORDER BY duration DESC
        LIMIT 10;
      `;

      // 獲取表掃描統計
      const tableScans = await (client as any).$queryRaw`
        SELECT 
          schemaname,
          relname AS table_name,
          seq_scan AS sequential_scans,
          seq_tup_read AS sequential_tuples_read,
          idx_scan AS index_scans,
          CASE 
            WHEN seq_scan + idx_scan > 0 
            THEN round(100.0 * seq_scan / (seq_scan + idx_scan), 2)
            ELSE 0 
          END AS seq_scan_percent,
          pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) AS table_size
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY seq_scan DESC
        LIMIT 20;
      `;

      return {
        queries,
        activeSlowQueries,
        tableScans,
        type,
      };
    }, 'admin:slow-queries:get');

    return NextResponse.json(result);
  } catch (error) {
    console.error('獲取慢查詢統計失敗:', error);
    return createErrorResponse(error, 'admin:slow-queries:get');
  }
}











