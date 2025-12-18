import { NextRequest } from 'next/server';

// IP 地理位置檢查結果
interface GeoLocationResult {
  country: string;
  countryCode: string;
  region: string;
  city: string;
  isAllowed: boolean;
  error?: string;
}

// IP 地理位置快取（避免重複查詢）
interface GeoCacheEntry {
  countryCode: string;
  timestamp: number;
}

class GeoLocationCache {
  private cache = new Map<string, GeoCacheEntry>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 小時快取

  get(ip: string): string | null {
    const entry = this.cache.get(ip);
    if (!entry) return null;

    // 檢查快取是否過期
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(ip);
      return null;
    }

    return entry.countryCode;
  }

  set(ip: string, countryCode: string): void {
    this.cache.set(ip, {
      countryCode,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

const geoCache = new GeoLocationCache();

/**
 * IP 地理位置檢查工具
 */
export class IPGeolocation {
  // 允許的國家代碼（台灣）
  private static readonly ALLOWED_COUNTRY_CODES = ['TW'];

  // 本地 IP 地址（開發環境使用）
  private static readonly LOCAL_IPS = [
    '127.0.0.1',
    '::1',
    'localhost',
    'unknown',
  ];

  /**
   * 獲取客戶端 IP 地址
   */
  static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip'); // Cloudflare

    if (forwarded) {
      // x-forwarded-for 可能包含多個 IP，取第一個
      return forwarded.split(',')[0].trim();
    }

    if (cfConnectingIP) {
      return cfConnectingIP.trim();
    }

    if (realIP) {
      return realIP.trim();
    }

    return request.ip || 'unknown';
  }

  /**
   * 檢查 IP 是否為本地 IP（開發環境）
   */
  static isLocalIP(ip: string): boolean {
    return this.LOCAL_IPS.includes(ip) || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.');
  }

  /**
   * 從 IP-API.com 獲取地理位置資訊
   */
  static async getGeoLocation(ip: string): Promise<GeoLocationResult> {
    // 檢查是否為本地 IP
    if (this.isLocalIP(ip)) {
      return {
        country: 'Taiwan',
        countryCode: 'TW',
        region: 'Local',
        city: 'Local',
        isAllowed: true,
      };
    }

    // 檢查快取
    const cachedCountryCode = geoCache.get(ip);
    if (cachedCountryCode) {
      return {
        country: cachedCountryCode === 'TW' ? 'Taiwan' : 'Unknown',
        countryCode: cachedCountryCode,
        region: 'Unknown',
        city: 'Unknown',
        isAllowed: cachedCountryCode === 'TW',
      };
    }

    try {
      // 使用 ip-api.com 免費 API（不需要 API key）
      // 限制：每分鐘 45 次請求
      const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,city`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        // 設置超時時間
        signal: AbortSignal.timeout(5000), // 5 秒超時
      });

      if (!response.ok) {
        throw new Error(`IP API 回應錯誤: ${response.status}`);
      }

      const data = await response.json();

      // 檢查 API 回應狀態
      if (data.status === 'fail') {
        console.warn(`IP 地理位置查詢失敗: ${data.message} (IP: ${ip})`);
        // 如果查詢失敗，為了安全起見，拒絕訪問
        return {
          country: 'Unknown',
          countryCode: 'UNKNOWN',
          region: 'Unknown',
          city: 'Unknown',
          isAllowed: false,
          error: data.message || '無法查詢地理位置',
        };
      }

      const countryCode = data.countryCode || 'UNKNOWN';
      const isAllowed = this.ALLOWED_COUNTRY_CODES.includes(countryCode);

      // 存入快取
      geoCache.set(ip, countryCode);

      return {
        country: data.country || 'Unknown',
        countryCode,
        region: data.region || 'Unknown',
        city: data.city || 'Unknown',
        isAllowed,
      };
    } catch (error: any) {
      console.error(`IP 地理位置查詢錯誤 (IP: ${ip}):`, error.message);

      // 如果查詢失敗，為了安全起見，拒絕訪問
      return {
        country: 'Unknown',
        countryCode: 'UNKNOWN',
        region: 'Unknown',
        city: 'Unknown',
        isAllowed: false,
        error: error.message || '地理位置查詢失敗',
      };
    }
  }

  /**
   * 檢查 IP 是否允許訪問（僅允許台灣）
   */
  static async isIPAllowed(request: NextRequest): Promise<{
    allowed: boolean;
    countryCode?: string;
    country?: string;
    error?: string;
  }> {
    const ip = this.getClientIP(request);

    // 本地 IP 允許訪問（開發環境）
    if (this.isLocalIP(ip)) {
      return {
        allowed: true,
        countryCode: 'TW',
        country: 'Taiwan (Local)',
      };
    }

    const geoResult = await this.getGeoLocation(ip);

    return {
      allowed: geoResult.isAllowed,
      countryCode: geoResult.countryCode,
      country: geoResult.country,
      error: geoResult.error,
    };
  }

  /**
   * 清除地理位置快取
   */
  static clearCache(): void {
    geoCache.clear();
  }
}






