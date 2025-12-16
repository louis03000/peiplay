import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

/**
 * Redis 連線測試 API
 * 用於驗證 Vercel 環境變數設定是否正確
 */
export async function GET() {
  const hasRedisUrl = !!process.env.UPSTASH_REDIS_REST_URL;
  const hasRedisToken = !!process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!hasRedisUrl || !hasRedisToken) {
    return NextResponse.json({
      status: 'not_configured',
      message: 'UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set',
      hint: 'Please set these in Vercel Dashboard → Settings → Environment Variables',
      hasUrl: hasRedisUrl,
      hasToken: hasRedisToken,
    });
  }

  if (!redis) {
    return NextResponse.json({
      status: 'not_connected',
      message: 'Redis client not available',
      redisUrl: process.env.UPSTASH_REDIS_REST_URL ? '***configured***' : 'not set',
    });
  }

  try {
    // 測試讀寫
    const testKey = 'test:connection';
    const testValue = `test-${Date.now()}`;
    await redis.set(testKey, testValue, { ex: 10 });
    const readValue = await redis.get(testKey);
    await redis.del(testKey);
    
    return NextResponse.json({
      status: 'connected',
      message: 'Upstash Redis is working correctly',
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

