import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis-cache';

/**
 * Redis 連線測試 API
 * 用於驗證 Vercel 環境變數設定是否正確
 */
export async function GET() {
  const hasRedisUrl = !!process.env.REDIS_URL;
  const client = getRedisClient();
  
  if (!hasRedisUrl) {
    return NextResponse.json({
      status: 'not_configured',
      message: 'REDIS_URL environment variable not set',
      hint: 'Please set REDIS_URL in Vercel Dashboard → Settings → Environment Variables',
    });
  }

  if (!client) {
    return NextResponse.json({
      status: 'not_connected',
      message: 'Redis client not available (redis package may not be installed)',
      redisUrl: process.env.REDIS_URL ? '***configured***' : 'not set',
    });
  }

  try {
    // 測試連線
    const pingResult = await client.ping();
    
    // 測試讀寫
    const testKey = 'test:connection';
    const testValue = `test-${Date.now()}`;
    await client.setEx(testKey, 10, testValue);
    const readValue = await client.get(testKey);
    await client.del(testKey);
    
    return NextResponse.json({
      status: 'connected',
      message: 'Redis is working correctly',
      ping: pingResult,
      readWriteTest: readValue === testValue ? 'passed' : 'failed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

