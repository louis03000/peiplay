/**
 * MFA (Multi-Factor Authentication) Service
 * 
 * 提供完整的 MFA 功能：
 * - TOTP 驗證
 * - Recovery codes 生成和管理
 * - 強制驗證流程
 */

import { prisma } from './prisma';
import speakeasy from 'speakeasy';
import crypto from 'crypto';
import { SecurityLogger } from './security-enhanced';

const RECOVERY_CODE_COUNT = 10; // 生成 10 個 recovery codes

/**
 * 生成 Recovery Codes
 * 
 * 格式：XXXX-XXXX-XXXX（12 位數字，每 4 位一組）
 */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    // 生成 12 位隨機數字
    const code = crypto.randomInt(100000000000, 999999999999).toString();
    // 格式化為 XXXX-XXXX-XXXX
    const formatted = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
    codes.push(formatted);
  }
  return codes;
}

/**
 * 哈希 Recovery Code（用於儲存）
 */
async function hashRecoveryCode(code: string): Promise<string> {
  const { hash } = await import('bcryptjs');
  return hash(code, 10); // 使用較低的 rounds，因為 recovery codes 較長
}

/**
 * 驗證 Recovery Code
 */
async function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  const { compare } = await import('bcryptjs');
  return compare(code, hash);
}

/**
 * 驗證 TOTP Token
 */
export function verifyTOTPToken(secret: string, token: string): boolean {
  try {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // 允許前後 2 個時間窗口（約 60 秒）
    });
  } catch (error) {
    console.error('TOTP verification error:', error);
    return false;
  }
}

/**
 * 驗證 MFA（TOTP 或 Recovery Code）
 */
export async function verifyMFA(
  userId: string,
  code: string,
  request?: any
): Promise<{
  valid: boolean;
  usedRecoveryCode: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorSecret: true,
      isTwoFactorEnabled: true,
      recoveryCodes: true,
    },
  });

  if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
    return { valid: false, usedRecoveryCode: false };
  }

  // 先嘗試 TOTP 驗證
  const totpValid = verifyTOTPToken(user.twoFactorSecret, code);
  if (totpValid) {
    return { valid: true, usedRecoveryCode: false };
  }

  // 如果 TOTP 失敗，嘗試 Recovery Code
  if (user.recoveryCodes && user.recoveryCodes.length > 0) {
    const codes = JSON.parse(user.recoveryCodes) as string[];
    
    for (let i = 0; i < codes.length; i++) {
      const hashedCode = codes[i];
      const isValid = await verifyRecoveryCode(code, hashedCode);
      
      if (isValid) {
        // 移除已使用的 recovery code
        codes.splice(i, 1);
        await prisma.user.update({
          where: { id: userId },
          data: {
            recoveryCodes: JSON.stringify(codes),
          },
        });

        // 記錄使用 recovery code
        await SecurityLogger.logSecurityEvent(
          userId,
          'MFA_VERIFICATION_FAILED',
          {
            method: 'recovery_code',
            timestamp: new Date().toISOString(),
          },
          request
        );

        return { valid: true, usedRecoveryCode: true };
      }
    }
  }

  // 驗證失敗，記錄事件
  await SecurityLogger.logSecurityEvent(
    userId,
    'MFA_VERIFICATION_FAILED',
    {
      method: 'totp',
      code: code.substring(0, 2) + '***', // 部分隱藏
      timestamp: new Date().toISOString(),
    },
    request
  );

  return { valid: false, usedRecoveryCode: false };
}

/**
 * 設置 MFA 並生成 Recovery Codes
 */
export async function setupMFA(
  userId: string,
  secret: string
): Promise<{
  recoveryCodes: string[];
}> {
  // 生成 recovery codes
  const codes = generateRecoveryCodes();
  const hashedCodes = await Promise.all(codes.map(hashRecoveryCode));

  // 更新用戶
  await prisma.user.update({
    where: { id: userId },
    data: {
      twoFactorSecret: secret,
      isTwoFactorEnabled: true,
      recoveryCodes: JSON.stringify(hashedCodes),
    },
  });

  // 記錄 MFA 啟用
  await SecurityLogger.logSecurityEvent(
    userId,
    'TWO_FACTOR_ENABLED',
    {
      timestamp: new Date().toISOString(),
    }
  );

  return { recoveryCodes: codes };
}

/**
 * 重新生成 Recovery Codes
 */
export async function regenerateRecoveryCodes(userId: string): Promise<{
  recoveryCodes: string[];
}> {
  const codes = generateRecoveryCodes();
  const hashedCodes = await Promise.all(codes.map(hashRecoveryCode));

  await prisma.user.update({
    where: { id: userId },
    data: {
      recoveryCodes: JSON.stringify(hashedCodes),
    },
  });

  // 記錄重新生成
  await SecurityLogger.logSecurityEvent(
    userId,
    'TWO_FACTOR_RECOVERY_CODES_REGENERATED',
    {
      timestamp: new Date().toISOString(),
    }
  );

  return { recoveryCodes: codes };
}

/**
 * 禁用 MFA
 */
export async function disableMFA(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isTwoFactorEnabled: false,
      twoFactorSecret: null,
      recoveryCodes: null,
    },
  });

  // 記錄 MFA 禁用
  await SecurityLogger.logSecurityEvent(
    userId,
    'TWO_FACTOR_DISABLED',
    {
      timestamp: new Date().toISOString(),
    }
  );
}

/**
 * 檢查用戶是否需要 MFA 驗證
 */
export async function requiresMFA(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isTwoFactorEnabled: true,
      role: true,
    },
  });

  if (!user) return false;

  // 管理員必須啟用 MFA
  if (user.role === 'ADMIN' && !user.isTwoFactorEnabled) {
    return true; // 管理員未啟用 MFA，需要強制啟用
  }

  // 一般用戶如果已啟用，需要驗證
  return user.isTwoFactorEnabled;
}

