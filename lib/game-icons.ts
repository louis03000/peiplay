/**
 * 遊戲圖標工具函數
 * 處理遊戲名稱的標準化和圖標路徑映射
 */

// 遊戲名稱到圖標檔名的映射（標準化後的遊戲名稱）
const GAME_ICON_MAP: Record<string, string> = {
  'csgo': 'csgo',
  'cs:go': 'csgo',
  'cs go': 'csgo',
  'counter-strike': 'csgo',
  
  'apex': 'apex',
  'apex legends': 'apex',
  'apex 英雄': 'apex',
  
  'lol': 'lol',
  'league of legends': 'lol',
  '英雄聯盟': 'lol',
  
  'pubg': 'pubg',
  'playerunknown\'s battlegrounds': 'pubg',
  
  'valorant': 'valorant',
  '特戰英豪': 'valorant',
}

// 遊戲名稱到 emoji 的映射（作為後備方案）
const GAME_EMOJI_MAP: Record<string, string> = {
  'csgo': '🔫',
  'cs:go': '🔫',
  'cs go': '🔫',
  'counter-strike': '🔫',
  
  'apex': '🚀',
  'apex legends': '🚀',
  'apex 英雄': '🚀',
  
  'lol': '⚔️',
  'league of legends': '⚔️',
  '英雄聯盟': '⚔️',
  
  'pubg': '🏃',
  'playerunknown\'s battlegrounds': '🏃',
  
  'valorant': '🎯',
  '特戰英豪': '🎯',
}

/**
 * 標準化遊戲名稱
 * 移除大小寫、空格、標點符號等，統一格式
 */
export function normalizeGameName(gameName: string): string {
  return gameName
    .toLowerCase()
    .trim()
    .replace(/[:：\s\-_]/g, '') // 移除冒號、空格、連字號、底線
    .replace(/['"]/g, '') // 移除引號
}

/**
 * 獲取遊戲圖標檔名
 * @param gameName 遊戲名稱（可以是任何格式）
 * @returns 圖標檔名（不含副檔名），如果沒有對應的圖標則返回 null
 */
export function getGameIconFileName(gameName: string): string | null {
  const normalized = normalizeGameName(gameName)
  
  // 直接匹配
  if (GAME_ICON_MAP[normalized]) {
    return GAME_ICON_MAP[normalized]
  }
  
  // 部分匹配（處理變體）
  for (const [key, iconName] of Object.entries(GAME_ICON_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return iconName
    }
  }
  
  return null
}

/**
 * 獲取遊戲圖標路徑（包含實際檔案副檔名映射）
 * 根據實際上傳的檔案名稱返回正確的路徑
 */
const ACTUAL_FILE_NAMES: Record<string, string> = {
  'csgo': 'csgo.png.png',      // 實際檔案名稱
  'apex': 'apex.png.png',      // 實際檔案名稱
  'lol': 'lol.png.jpg',        // 實際檔案名稱
  'pubg': 'pubg.png.jpeg',     // 實際檔案名稱
  'valorant': 'valorant.png.webp', // 實際檔案名稱
}

/**
 * 獲取遊戲圖標路徑
 * @param gameName 遊戲名稱
 * @returns 圖標路徑，如果沒有對應的圖標則返回 null
 */
export function getGameIconPath(gameName: string): string | null {
  const iconFileName = getGameIconFileName(gameName)
  if (!iconFileName) {
    return null
  }
  
  // 如果有實際檔案名稱映射，使用實際檔案名稱
  if (ACTUAL_FILE_NAMES[iconFileName]) {
    return `/game-icons/${ACTUAL_FILE_NAMES[iconFileName]}`
  }
  
  // 否則嘗試標準的 .png
  return `/game-icons/${iconFileName}.png`
}

/**
 * 獲取遊戲圖標路徑（包含實際檔案副檔名檢查）
 * 這個函數會在客戶端動態檢查檔案是否存在
 */
export function getGameIconPathWithFallback(gameName: string): string[] {
  const iconFileName = getGameIconFileName(gameName)
  if (!iconFileName) {
    return []
  }
  
  // 如果有實際檔案名稱映射，優先使用
  if (ACTUAL_FILE_NAMES[iconFileName]) {
    return [`/game-icons/${ACTUAL_FILE_NAMES[iconFileName]}`]
  }
  
  // 返回所有可能的檔案路徑，讓客戶端嘗試載入
  return [
    `/game-icons/${iconFileName}.png`,
    `/game-icons/${iconFileName}.png.png`, // 處理重複副檔名的情況
    `/game-icons/${iconFileName}.jpg`,
    `/game-icons/${iconFileName}.jpeg`,
    `/game-icons/${iconFileName}.webp`,
  ]
}

/**
 * 獲取遊戲 emoji（作為後備方案）
 * @param gameName 遊戲名稱
 * @returns emoji 字串，如果沒有對應的 emoji 則返回 '🎮'
 */
export function getGameEmoji(gameName: string): string {
  const normalized = normalizeGameName(gameName)
  
  // 直接匹配
  if (GAME_EMOJI_MAP[normalized]) {
    return GAME_EMOJI_MAP[normalized]
  }
  
  // 部分匹配
  for (const [key, emoji] of Object.entries(GAME_EMOJI_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return emoji
    }
  }
  
  return '🎮' // 預設 emoji
}

/**
 * 檢查遊戲是否有對應的圖標
 * @param gameName 遊戲名稱
 * @returns 是否有對應的圖標
 */
export function hasGameIcon(gameName: string): boolean {
  return getGameIconFileName(gameName) !== null
}

