import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

// 安全標頭配置
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https:;
    connect-src 'self' https://api.vercel.com;
    frame-src 'self' https://vercel.live;
  `.replace(/\s+/g, ' ').trim(),
};

// 速率限制配置
export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 100, // 每個 IP 每 15 分鐘最多 100 次請求
  message: '請求過於頻繁，請稍後再試',
  standardHeaders: true,
  legacyHeaders: false,
};

// 敏感操作速率限制
export const sensitiveRateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 分鐘
  max: 5, // 每個 IP 每 15 分鐘最多 5 次敏感操作
  message: '敏感操作請求過於頻繁，請稍後再試',
};

// 輸入驗證和清理
export class InputValidator {
  // 清理 HTML 標籤
  static sanitizeHtml(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

  // 驗證 Email 格式
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // 驗證密碼強度（自定義版本）
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // 基本長度要求：至少8個字符
    if (password.length < 8) {
      errors.push('密碼長度至少 8 個字符');
    }
    
    if (password.length > 128) {
      errors.push('密碼長度不能超過 128 個字符');
    }
    
    // 檢查是否包含至少一個英文字母
    if (!/[a-zA-Z]/.test(password)) {
      errors.push('密碼必須包含至少一個英文字母');
    }
    
    // 檢查是否包含至少一個數字
    if (!/\d/.test(password)) {
      errors.push('密碼必須包含至少一個數字');
    }
    
    // 檢查常見弱密碼（主要安全風險）
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'peiplay2025', 'peiplay', 'admin123', '12345678',
      'abcdefgh', 'abcdefg1', '1234567a', 'asdfghjk'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('密碼過於常見，請選擇更安全的密碼');
    }
    
    // 檢查是否為純數字或純字母
    if (/^\d+$/.test(password)) {
      errors.push('密碼不能只包含數字');
    }
    
    if (/^[a-zA-Z]+$/.test(password)) {
      errors.push('密碼不能只包含英文字母');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 驗證電話號碼
  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^(\+886|0)?[0-9]{8,10}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  // 驗證 Discord ID (支持舊格式和新格式)
  static isValidDiscordId(discordId: string): boolean {
    // 新格式：用戶名#1234
    const newFormatRegex = /^.{2,32}#\d{4}$/;
    // 舊格式：純用戶名
    const oldFormatRegex = /^[a-zA-Z0-9._]{2,32}$/;
    
    return newFormatRegex.test(discordId) || oldFormatRegex.test(discordId);
  }

  // 清理和驗證用戶輸入
  static sanitizeUserInput(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeHtml(input);
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeUserInput(item));
    }
    
    if (input && typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeUserInput(value);
      }
      return sanitized;
    }
    
    return input;
  }
}

// 安全日誌記錄
export class SecurityLogger {
  static logSecurityEvent(
    event: string,
    details: {
      userId?: string;
      email?: string;
      ip?: string;
      userAgent?: string;
      activity?: string;
      path?: string;
      additionalInfo?: any;
    }
  ) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...details,
    };
    
    console.log(`🔒 SECURITY: ${JSON.stringify(logEntry)}`);
    
    // 在生產環境中，這裡應該發送到專門的安全日誌系統
    // 例如：Splunk, ELK Stack, 或雲端日誌服務
  }

  static logFailedLogin(email: string, ip: string, userAgent: string) {
    this.logSecurityEvent('FAILED_LOGIN', {
      email,
      ip,
      userAgent,
    });
  }

  static logSuccessfulLogin(userId: string, email: string, ip: string) {
    this.logSecurityEvent('SUCCESSFUL_LOGIN', {
      userId,
      email,
      ip,
    });
  }

  static logSuspiciousActivity(activity: string, details: any) {
    this.logSecurityEvent('SUSPICIOUS_ACTIVITY', {
      activity,
      additionalInfo: details,
    });
  }
}

// IP 白名單/黑名單檢查
export class IPFilter {
  private static blockedIPs = new Set<string>();
  private static allowedIPs = new Set<string>();

  static blockIP(ip: string) {
    this.blockedIPs.add(ip);
  }

  static allowIP(ip: string) {
    this.allowedIPs.add(ip);
  }

  static isBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }

  static isAllowed(ip: string): boolean {
    if (this.allowedIPs.size === 0) return true; // 如果沒有白名單，允許所有 IP
    return this.allowedIPs.has(ip);
  }

  static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    
    if (realIP) {
      return realIP;
    }
    
    return request.ip || 'unknown';
  }
}

// 會話安全檢查
export class SessionSecurity {
  static validateSession(session: any): boolean {
    if (!session || !session.user) {
      return false;
    }

    // 檢查會話是否過期
    const sessionAge = Date.now() - (session.expires || 0);
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 天
    
    if (sessionAge > maxAge) {
      return false;
    }

    return true;
  }

  static generateSecureToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

// 資料庫查詢安全
export class DatabaseSecurity {
  static sanitizeQuery(query: string): string {
    // 移除潛在的 SQL 注入字符
    return query
      .replace(/[';]/g, '')  // 修復正則表達式：移除單引號和分號
      .replace(/--/g, '')    // 單獨處理 SQL 註釋
      .replace(/union/gi, '')
      .replace(/select/gi, '')
      .replace(/insert/gi, '')
      .replace(/update/gi, '')
      .replace(/delete/gi, '')
      .replace(/drop/gi, '')
      .trim();
  }

  static validateQueryParams(params: any): boolean {
    if (!params || typeof params !== 'object') {
      return false;
    }

    // 檢查參數中是否包含危險字符
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /union\s+select/i,
      /drop\s+table/i,
    ];

    const paramString = JSON.stringify(params);
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(paramString)) {
        return false;
      }
    }

    return true;
  }
}
