/**
 * Password History Management
 * 
 * 管理密碼歷史，防止重複使用最近 5 個密碼
 * 注意：不強制密碼年齡限制，僅防止密碼重用
 */

import { prisma } from './prisma';
import { compare } from 'bcryptjs';

const PASSWORD_HISTORY_LIMIT = 5; // 保留最近 5 個密碼

/**
 * 檢查密碼是否在歷史記錄中
 */
export async function isPasswordInHistory(
  userId: string,
  passwordHash: string
): Promise<boolean> {
  const history = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: PASSWORD_HISTORY_LIMIT,
  });

  // 檢查新密碼是否與歷史密碼相同
  for (const record of history) {
    const isMatch = await compare(passwordHash, record.passwordHash);
    if (isMatch) {
      return true;
    }
  }

  return false;
}

/**
 * 添加密碼到歷史記錄
 */
export async function addPasswordToHistory(
  userId: string,
  passwordHash: string
): Promise<void> {
  // 添加新記錄
  await prisma.passwordHistory.create({
    data: {
      userId,
      passwordHash,
    },
  });

  // 獲取所有歷史記錄
  const allHistory = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  // 如果超過限制，刪除最舊的記錄
  if (allHistory.length > PASSWORD_HISTORY_LIMIT) {
    const toDelete = allHistory.slice(PASSWORD_HISTORY_LIMIT);
    await prisma.passwordHistory.deleteMany({
      where: {
        id: {
          in: toDelete.map((h) => h.id),
        },
      },
    });
  }
}


/**
 * 更新密碼並記錄歷史
 */
export async function updatePasswordWithHistory(
  userId: string,
  newPasswordHash: string
): Promise<void> {
  // 檢查是否在歷史記錄中
  const inHistory = await isPasswordInHistory(userId, newPasswordHash);
  if (inHistory) {
    throw new Error('不能使用最近使用過的密碼，請選擇不同的密碼');
  }

  // 更新密碼和更新時間
  await prisma.user.update({
    where: { id: userId },
    data: {
      password: newPasswordHash,
      passwordUpdatedAt: new Date(),
    },
  });

  // 添加到歷史記錄
  await addPasswordToHistory(userId, newPasswordHash);
}

