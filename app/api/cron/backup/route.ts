/**
 * 自動備份 Cron Job API
 * 
 * 由 Vercel Cron 或類似服務調用
 * 執行每日資料庫備份
 */

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

// 驗證 Cron Secret（防止未授權調用）
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // 驗證 Cron Secret
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 執行備份腳本
    const scriptPath = path.join(process.cwd(), 'scripts', 'backup_postgresql.js');
    
    console.log('🔄 開始自動備份...');
    execSync(`node ${scriptPath}`, {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
        BACKUP_DIR: process.env.BACKUP_DIR || './backups',
        RETENTION_DAYS: process.env.RETENTION_DAYS || '7',
      },
    });

    return NextResponse.json({
      success: true,
      message: '備份完成',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ 自動備份失敗:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

