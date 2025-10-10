import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './prisma';

export class SecurityEnhanced {
  // 密碼強度檢查
  static validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('密碼長度至少需要 8 個字符');
    }
    
    if (password.length > 128) {
      errors.push('密碼長度不能超過 128 個字符');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('密碼必須包含至少一個小寫字母');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('密碼必須包含至少一個大寫字母');
    }
    
    if (!/\d/.test(password)) {
      errors.push('密碼必須包含至少一個數字');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('密碼必須包含至少一個特殊字符');
    }
    
    // 檢查常見弱密碼
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'qwerty',
      'letmein', 'welcome', 'monkey', 'dragon', 'master'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('密碼過於常見，請使用更複雜的密碼');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 檢查密碼是否在洩露列表中（模擬檢查，實際應使用 HaveIBeenPwned API）
  static async checkPasswordBreach(password: string): Promise<boolean> {
    try {
      // 生成密碼的 SHA-1 雜湊值
      const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase();
      const hashPrefix = hash.substring(0, 5);
      const hashSuffix = hash.substring(5);
      
      // 這裡應該調用 HaveIBeenPwned API
      // 為了演示，我們模擬檢查
      const response = await fetch(`https://api.pwnedpasswords.com/range/${hashPrefix}`);
      
      if (response.ok) {
        const data = await response.text();
        return data.includes(hashSuffix);
      }
      
      return false;
    } catch (error) {
      console.error('密碼洩露檢查失敗:', error);
      return false; // 如果檢查失敗，允許使用密碼但記錄警告
    }
  }

  // 增強密碼雜湊
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12; // 增加鹽值輪數
    return await bcrypt.hash(password, saltRounds);
  }

  // 驗證密碼
  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }

  // 生成安全令牌
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // 生成 CSRF 令牌
  static generateCSRFToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // 驗證 CSRF 令牌
  static verifyCSRFToken(token: string, sessionToken: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(sessionToken, 'hex')
    );
  }

  // 記錄安全事件
  static async logSecurityEvent(
    userId: string,
    eventType: 'LOGIN_ATTEMPT' | 'PASSWORD_CHANGE' | 'SUSPICIOUS_ACTIVITY' | 'LOGIN_SUCCESS' | 'LOGIN_FAILED',
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      await prisma.securityLog.create({
        data: {
          userId,
          eventType,
          details: JSON.stringify(details),
          ipAddress: details.ipAddress || 'unknown',
          userAgent: details.userAgent || 'unknown',
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.error('記錄安全事件失敗:', error);
    }
  }

  // 檢查登入頻率限制
  static async checkLoginRateLimit(identifier: string): Promise<{ allowed: boolean; remainingAttempts: number }> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    
    try {
      // 計算最近 5 分鐘內的失敗登入次數
      const recentAttempts = await prisma.securityLog.count({
        where: {
          eventType: 'LOGIN_FAILED',
          ipAddress: identifier,
          timestamp: {
            gte: fiveMinutesAgo,
          },
        },
      });
      
      const maxAttempts = 5;
      const remainingAttempts = Math.max(0, maxAttempts - recentAttempts);
      
      return {
        allowed: remainingAttempts > 0,
        remainingAttempts,
      };
    } catch (error) {
      console.error('檢查登入頻率限制失敗:', error);
      return { allowed: true, remainingAttempts: 5 };
    }
  }

  // 強制密碼更新檢查
  static async checkPasswordAge(userId: string): Promise<{ needsUpdate: boolean; daysSinceLastUpdate: number }> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { updatedAt: true },
      });
      
      if (!user) {
        return { needsUpdate: true, daysSinceLastUpdate: 999 };
      }
      
      const daysSinceLastUpdate = Math.floor(
        (Date.now() - user.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      const needsUpdate = daysSinceLastUpdate > 90; // 90 天後需要更新密碼
      
      return { needsUpdate, daysSinceLastUpdate };
    } catch (error) {
      console.error('檢查密碼年齡失敗:', error);
      return { needsUpdate: false, daysSinceLastUpdate: 0 };
    }
  }
}
