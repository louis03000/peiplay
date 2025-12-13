/**
 * Have I Been Pwned (HIBP) Password Breach Check
 * 
 * 使用 k-Anonymity API 檢查密碼是否在洩露列表中
 * 不會傳送完整密碼或 hash 到第三方
 * 
 * API: https://haveibeenpwned.com/API/v3#PwnedPasswords
 */

import crypto from 'crypto';
import { SecurityLogger } from './security-enhanced';

const HIBP_API_URL = 'https://api.pwnedpasswords.com/range/';

/**
 * 計算 SHA-1 hash
 */
function sha1(text: string): string {
  return crypto.createHash('sha1').update(text).digest('hex').toUpperCase();
}

/**
 * 使用 k-Anonymity 檢查密碼是否在洩露列表中
 * 
 * 流程：
 * 1. 計算密碼的 SHA-1 hash
 * 2. 只傳送前 5 個字符（prefix）到 API
 * 3. API 返回所有以該 prefix 開頭的 hash 後綴
 * 4. 在本地比對完整 hash 是否在列表中
 * 
 * @param password - 要檢查的密碼
 * @returns 是否在洩露列表中
 */
export async function checkPasswordBreach(password: string): Promise<{
  breached: boolean;
  count?: number; // 在洩露列表中出現的次數
}> {
  try {
    // 計算 SHA-1 hash
    const hash = sha1(password);
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    // 調用 HIBP API（只傳送前 5 個字符）
    const response = await fetch(`${HIBP_API_URL}${prefix}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'PeiPlay-Security-Check/1.0',
        'Add-Padding': 'true', // 請求 padding 以隱藏實際查詢
      },
    });

    if (!response.ok) {
      // API 錯誤時，為了可用性，允許密碼（但記錄警告）
      console.warn('⚠️  HIBP API error:', response.status, response.statusText);
      return { breached: false };
    }

    const text = await response.text();
    const lines = text.split('\n');

    // 在返回的 hash 列表中查找匹配的後綴
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(':');
      if (hashSuffix.trim() === suffix) {
        const count = parseInt(countStr?.trim() || '0', 10);
        
        // 記錄到 SecurityLog
        await SecurityLogger.logSecurityEvent(
          null, // 此時還沒有用戶 ID
          'PASSWORD_BREACHED_CHECK',
          {
            breached: true,
            count,
            timestamp: new Date().toISOString(),
          }
        );

        return {
          breached: true,
          count,
        };
      }
    }

    // 沒有找到匹配，密碼安全
    return { breached: false };
  } catch (error) {
    // 網路錯誤或其他異常時，為了可用性，允許密碼（但記錄錯誤）
    console.error('❌ HIBP check error:', error);
    
    // 記錄錯誤但不阻止註冊/變更密碼
    await SecurityLogger.logSecurityEvent(
      null,
      'PASSWORD_BREACHED_CHECK',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }
    ).catch(() => {}); // 忽略記錄失敗

    return { breached: false };
  }
}

/**
 * 驗證密碼並檢查洩露
 * 
 * @param password - 要檢查的密碼
 * @returns 驗證結果
 */
export async function validatePasswordWithBreachCheck(password: string): Promise<{
  valid: boolean;
  breached: boolean;
  error?: string;
  breachCount?: number;
}> {
  // 先檢查密碼強度（使用現有的驗證）
  const { PasswordSecurity } = await import('./security-enhanced');
  const strengthCheck = PasswordSecurity.validatePassword(password);

  if (!strengthCheck.isValid) {
    return {
      valid: false,
      breached: false,
      error: strengthCheck.errors.join(', '),
    };
  }

  // 檢查密碼是否在洩露列表中
  const breachCheck = await checkPasswordBreach(password);

  if (breachCheck.breached) {
    return {
      valid: false,
      breached: true,
      error: `此密碼已在資料外洩事件中出現 ${breachCheck.count || 0} 次，請選擇更安全的密碼`,
      breachCount: breachCheck.count,
    };
  }

  return {
    valid: true,
    breached: false,
  };
}

