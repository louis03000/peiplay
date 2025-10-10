import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { NextRequest } from 'next/server'

// 密碼安全驗證
export class PasswordSecurity {
  static readonly MIN_LENGTH = 8
  static readonly MAX_LENGTH = 128
  static readonly SALT_ROUNDS = 12

  static validatePassword(password: string): {
    isValid: boolean
    errors: string[]
    strength: 'weak' | 'medium' | 'strong'
  } {
    const errors: string[] = []
    
    if (password.length < this.MIN_LENGTH) {
      errors.push(`密碼長度至少需要 ${this.MIN_LENGTH} 個字元`)
    }
    
    if (password.length > this.MAX_LENGTH) {
      errors.push(`密碼長度不能超過 ${this.MAX_LENGTH} 個字元`)
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('密碼必須包含至少一個小寫字母')
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('密碼必須包含至少一個大寫字母')
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('密碼必須包含至少一個數字')
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('密碼必須包含至少一個特殊字元')
    }
    
    // 檢查常見密碼
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'dragon', 'master', 'hello', 'freedom', 'whatever'
    ]
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('密碼不能使用常見的弱密碼')
    }
    
    // 計算密碼強度
    let strength: 'weak' | 'medium' | 'strong' = 'weak'
    if (errors.length === 0) {
      if (password.length >= 12 && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        strength = 'strong'
      } else if (password.length >= 10) {
        strength = 'medium'
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      strength
    }
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS)
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }
}

// 輸入驗證
export class InputValidator {
  static sanitizeUserInput(input: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        // 移除潛在的危險字符
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .trim()
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized
  }

  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }

  static isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{8,15}$/
    return phoneRegex.test(phone)
  }

  static isValidDiscordId(discordId: string): boolean {
    // Discord 用戶名格式：2-32 個字符，不能以空格或特殊字符開頭
    const discordRegex = /^.{2,32}$/
    return discordRegex.test(discordId) && !discordId.startsWith(' ')
  }

  static sanitizeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }
}

// 安全日誌記錄
export class SecurityLogger {
  static logSecurityEvent(
    userId: string,
    eventType: string,
    details: Record<string, any>,
    request?: NextRequest
  ) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId,
      eventType,
      details,
      ip: request?.ip || request?.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request?.headers.get('user-agent') || 'unknown',
    }
    
    // 記錄到控制台（生產環境中應該記錄到安全的日誌系統）
    console.log('🔒 Security Event:', JSON.stringify(logEntry, null, 2))
    
    // TODO: 在生產環境中，這裡應該將日誌發送到安全的日誌服務
    // 例如：Winston, LogRocket, 或自定義的日誌 API
  }

  static logFailedLogin(email: string, ip: string, userAgent: string) {
    this.logSecurityEvent('anonymous', 'FAILED_LOGIN', {
      email: email.substring(0, 3) + '***', // 部分隱藏 email
      attemptCount: 1, // 這裡應該從資料庫查詢實際嘗試次數
    })
  }

  static logSuccessfulLogin(userId: string, email: string, ip: string) {
    this.logSecurityEvent(userId, 'SUCCESSFUL_LOGIN', {
      email: email.substring(0, 3) + '***',
    })
  }

  static logSuspiciousActivity(userId: string, activity: string, details: Record<string, any>) {
    this.logSecurityEvent(userId, 'SUSPICIOUS_ACTIVITY', {
      activity,
      ...details,
    })
  }
}

// 速率限制
export class RateLimiter {
  private static attempts: Map<string, { count: number; lastAttempt: number }> = new Map()
  
  static checkRateLimit(
    identifier: string,
    maxAttempts: number = 5,
    windowMs: number = 15 * 60 * 1000 // 15 分鐘
  ): { allowed: boolean; remainingAttempts: number; resetTime: number } {
    const now = Date.now()
    const key = identifier
    
    if (!this.attempts.has(key)) {
      this.attempts.set(key, { count: 0, lastAttempt: now })
    }
    
    const attempt = this.attempts.get(key)!
    
    // 如果超過時間窗口，重置計數
    if (now - attempt.lastAttempt > windowMs) {
      attempt.count = 0
    }
    
    attempt.count++
    attempt.lastAttempt = now
    
    const remainingAttempts = Math.max(0, maxAttempts - attempt.count)
    const resetTime = attempt.lastAttempt + windowMs
    
    return {
      allowed: attempt.count <= maxAttempts,
      remainingAttempts,
      resetTime
    }
  }
  
  static resetRateLimit(identifier: string) {
    this.attempts.delete(identifier)
  }
}

// CSRF 保護
export class CSRFProtection {
  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }
  
  static verifyToken(token: string, sessionToken: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(sessionToken, 'hex')
    )
  }
}

// SQL 注入防護
export class SQLInjectionProtection {
  static sanitizeQuery(input: string): string {
    // 移除潛在的 SQL 注入字符
    return input
      .replace(/['";\\]/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .replace(/xp_/gi, '')
      .replace(/sp_/gi, '')
  }
  
  static validateQueryParams(params: Record<string, any>): boolean {
    const dangerousPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /insert\s+into/i,
      /update\s+set/i,
      /exec\s*\(/i,
      /script\s*>/i,
    ]
    
    for (const value of Object.values(params)) {
      if (typeof value === 'string') {
        for (const pattern of dangerousPatterns) {
          if (pattern.test(value)) {
            return false
          }
        }
      }
    }
    
    return true
  }
}

// 會話安全
export class SessionSecurity {
  static generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex')
  }
  
  static validateSessionId(sessionId: string): boolean {
    // 檢查 session ID 格式
    return /^[a-f0-9]{64}$/.test(sessionId)
  }
  
  static getSessionExpiryTime(): Date {
    // 24 小時後過期
    return new Date(Date.now() + 24 * 60 * 60 * 1000)
  }
}

// 文件上傳安全
export class FileUploadSecurity {
  static readonly ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  static readonly MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  
  static validateImageFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!this.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      errors.push('不支援的檔案格式，僅支援 JPEG、PNG、WebP')
    }
    
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`檔案大小不能超過 ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`)
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
  
  static generateSecureFileName(originalName: string): string {
    const ext = originalName.split('.').pop()
    const timestamp = Date.now()
    const randomString = crypto.randomBytes(8).toString('hex')
    return `${timestamp}_${randomString}.${ext}`
  }
}

// 主要安全類別
export class SecurityEnhanced {
  static async logSecurityEvent(
    userId: string,
    eventType: string,
    details: Record<string, any>,
    request?: NextRequest
  ) {
    SecurityLogger.logSecurityEvent(userId, eventType, details, request)
  }
  
  static checkRateLimit(identifier: string, maxAttempts?: number, windowMs?: number) {
    return RateLimiter.checkRateLimit(identifier, maxAttempts, windowMs)
  }
  
  static validatePassword(password: string) {
    return PasswordSecurity.validatePassword(password)
  }
  
  static async hashPassword(password: string) {
    return PasswordSecurity.hashPassword(password)
  }
  
  static async verifyPassword(password: string, hash: string) {
    return PasswordSecurity.verifyPassword(password, hash)
  }
  
  static sanitizeInput(input: Record<string, any>) {
    return InputValidator.sanitizeUserInput(input)
  }
  
  static validateEmail(email: string) {
    return InputValidator.isValidEmail(email)
  }
  
  static validatePhone(phone: string) {
    return InputValidator.isValidPhone(phone)
  }
  
  static validateDiscordId(discordId: string) {
    return InputValidator.isValidDiscordId(discordId)
  }
}