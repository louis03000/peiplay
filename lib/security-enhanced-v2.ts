/**
 * Enhanced Security Module for PeiPlay
 * 
 * 提供：
 * - Argon2 密碼雜湊（取代 bcrypt）
 * - 敏感資料加密（KMS/環境變數）
 * - 密碼強度驗證
 */

import crypto from 'crypto';

// ============================================
// Argon2 密碼雜湊（需要安裝 argon2 套件）
// ============================================

let argon2: any = null;

try {
  // 動態載入 argon2（如果可用）
  argon2 = require('argon2');
} catch (error) {
  console.warn('⚠️  argon2 not installed, falling back to bcrypt');
}

/**
 * Argon2 密碼雜湊配置
 */
const ARGON2_CONFIG = {
  type: argon2?.argon2id, // 使用 argon2id（最安全）
  memoryCost: 65536,      // 64 MB
  timeCost: 3,            // 3 次迭代
  parallelism: 4,        // 4 個執行緒
};

/**
 * 使用 Argon2 雜湊密碼（如果可用，否則回退到 bcrypt）
 */
export async function hashPassword(password: string): Promise<string> {
  if (argon2) {
    try {
      return await argon2.hash(password, ARGON2_CONFIG);
    } catch (error) {
      console.error('Argon2 hash error:', error);
      // Fallback to bcrypt
    }
  }

  // Fallback to bcrypt
  const bcrypt = require('bcryptjs');
  return await bcrypt.hash(password, 12);
}

/**
 * 驗證密碼
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  // 檢查是否為 Argon2 hash（以 $argon2id$ 開頭）
  if (hash.startsWith('$argon2')) {
    if (!argon2) {
      throw new Error('Argon2 hash detected but argon2 package not available');
    }
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      console.error('Argon2 verify error:', error);
      return false;
    }
  }

  // Fallback to bcrypt
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(password, hash);
}

// ============================================
// 敏感資料加密（使用 AES-256-GCM）
// ============================================

/**
 * 獲取加密金鑰（從環境變數或 KMS）
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable not set');
  }

  // 如果 key 是 hex 字串，轉換為 Buffer
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }

  // 否則使用 SHA-256 hash
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * 加密敏感資料（例如：身分證號碼）
 */
export function encryptSensitiveData(data: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // 組合：iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 解密敏感資料
 */
export function decryptSensitiveData(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * 雜湊敏感資料（單向，用於比對）
 * 使用 HMAC-SHA256 + pepper
 */
export function hashSensitiveData(data: string): string {
  const pepper = process.env.HASH_PEPPER || 'default-pepper-change-in-production';
  return crypto
    .createHmac('sha256', pepper)
    .update(data)
    .digest('hex');
}

/**
 * 驗證敏感資料雜湊
 */
export function verifySensitiveDataHash(data: string, hash: string): boolean {
  const computedHash = hashSensitiveData(data);
  return crypto.timingSafeEqual(
    Buffer.from(computedHash),
    Buffer.from(hash)
  );
}

// ============================================
// 密碼強度驗證
// ============================================

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('密碼長度至少需要 8 個字元');
  }

  if (password.length > 128) {
    errors.push('密碼長度不能超過 128 個字元');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('密碼必須包含至少一個小寫字母');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('密碼必須包含至少一個大寫字母');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('密碼必須包含至少一個數字');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('密碼必須包含至少一個特殊字元');
  }

  // 檢查常見弱密碼
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
  ];

  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('密碼不能使用常見的弱密碼');
  }

  // 計算強度
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  if (errors.length === 0) {
    if (password.length >= 12 && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      strength = 'strong';
    } else if (password.length >= 10) {
      strength = 'medium';
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

// ============================================
// 遷移輔助：從 bcrypt 遷移到 argon2
// ============================================

/**
 * 檢查密碼雜湊是否為 bcrypt
 */
export function isBcryptHash(hash: string): boolean {
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
}

/**
 * 遷移密碼雜湊（當用戶登入時自動遷移）
 */
export async function migratePasswordHash(
  password: string,
  oldHash: string
): Promise<string | null> {
  if (!isBcryptHash(oldHash)) {
    return null; // 已經是 argon2 或未知格式
  }

  // 驗證舊密碼
  const bcrypt = require('bcryptjs');
  const isValid = await bcrypt.compare(password, oldHash);
  
  if (!isValid) {
    return null; // 密碼不正確
  }

  // 生成新的 argon2 hash
  return await hashPassword(password);
}

