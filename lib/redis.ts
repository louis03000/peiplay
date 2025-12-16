/**
 * Upstash Redis Client (HTTP 模式)
 * 
 * 適用於 Vercel Serverless
 * 使用 @upstash/redis 套件
 */

import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

