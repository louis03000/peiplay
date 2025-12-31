/**
 * 遊戲庫映射表
 * 用於中英文遊戲名稱的互通匹配
 */

// 遊戲庫：包含所有支持的遊戲及其中英文名稱
export const GAME_LIBRARY: Array<{
  english: string;
  chinese: string;
  aliases?: string[]; // 其他可能的別名
}> = [
  { english: 'Fortnite', chinese: '堡垒之夜' },
  { english: 'Minecraft', chinese: '我的世界' },
  { english: 'Roblox', chinese: '羅布樂思' },
  { english: 'PUBG Mobile', chinese: '絕地求生' },
  { english: 'Call of Duty: Mobile', chinese: '決勝時刻' },
  { english: 'Free Fire MAX', chinese: '火力全開 MAX' },
  { english: 'Genshin Impact', chinese: '原神' },
  { english: 'Honor of Kings', chinese: '王者榮耀' },
  { english: 'Arena of Valor', chinese: '傳說對決' },
  { english: 'Delta Force', chinese: '德爾塔部隊' },
  { english: 'Snaky Cat', chinese: '蛇貓' },
  { english: 'Aceforce 2', chinese: 'Aceforce 2' },
  { english: 'The Division Resurgence', chinese: '全境封鎖 重生' },
  { english: 'Sonic Rumble', chinese: '音速咆哮' },
  { english: 'Strinova', chinese: 'Strinova' },
  { english: 'Starward', chinese: 'Starward' },
  { english: 'Black Beacon', chinese: '黑色信標' },
  { english: 'Eggy Party', chinese: '蛋仔派對' },
  { english: 'Rocket League', chinese: '火箭聯盟' },
  { english: 'Call of Duty: Warzone', chinese: '決勝時刻 戰區', aliases: ['Warzone', 'Warzone 2.0'] },
  { english: 'Arc Raiders', chinese: 'Arc Raiders' },
  { english: 'Helldivers 2', chinese: '鋼鐵衛士 2' },
  { english: 'Among Us', chinese: '我們之中' },
  { english: 'TETR.IO', chinese: 'TETR.IO' },
  { english: 'World of Tanks Blitz', chinese: '戰車世界 閃擊戰' },
  { english: 'Forza Horizon 5', chinese: '地平線 5' },
  { english: 'Halo Infinite', chinese: '光環 無限' },
  { english: 'Palworld', chinese: 'Palworld' },
  { english: 'Asphalt Legends', chinese: 'Asphalt Legends' },
  { english: 'eFootball', chinese: 'eFootball' },
  { english: 'Aliens: Fireteam Elite', chinese: '異形 火力菁英' },
  { english: 'Clone Drone in the Danger Zone', chinese: '克隆機器人 危險地帶' },
  { english: 'Age of Empires II: Definitive Edition', chinese: '世紀帝國 II 終極版' },
  { english: 'Age of Empires IV', chinese: '世紀帝國 IV' },
  { english: 'World War Z', chinese: '喪屍世界 Z' },
  { english: 'Destiny: Rising', chinese: '命運：崛起' },
  { english: 'BGMI', chinese: '印度版絕地求生', aliases: ['Battlegrounds Mobile India'] },
  { english: 'Clash of Clans', chinese: '部落衝突' },
  { english: 'Mario Kart Tour', chinese: '瑪利歐賽車 巡迴賽' },
  { english: 'Hearthstone', chinese: '爐石戰記' },
  { english: 'FIFA Mobile 2025', chinese: 'FIFA 手機版 2025' },
  { english: 'Roblox Universe', chinese: '羅布樂思 宇宙', aliases: ['Roblox 內玩家自創多人遊戲合集'] },
  { english: 'MultiVersus', chinese: '多元對戰' },
  { english: 'Paladins', chinese: '聖騎士' },
  { english: 'Dauntless', chinese: '無畏' },
  { english: 'SMITE', chinese: '神之戰' },
  { english: 'Brawlhalla', chinese: '爆鬥英雄' },
  { english: 'No Man\'s Sky', chinese: '無人深空' },
  { english: 'Realm Royale', chinese: '皇家領域' },
  { english: 'Battletoads', chinese: '戰鬥癩蛤蟆' },
  // 添加常見的遊戲別名
  { english: 'League of Legends', chinese: '英雄聯盟', aliases: ['LOL', 'lol', 'LoL'] },
  { english: 'Apex Legends', chinese: 'Apex 英雄', aliases: ['APEX', 'apex', 'Apex'] },
  { english: 'PUBG', chinese: 'PUBG', aliases: ['PlayerUnknown\'s Battlegrounds'] },
  { english: 'CS:GO', chinese: 'CS:GO', aliases: ['CSGO', 'csgo', 'Counter-Strike: Global Offensive'] },
  { english: 'VALORANT', chinese: '特戰英豪', aliases: ['Valorant', 'valorant', 'VAL'] },
  { english: 'DOTA 2', chinese: 'DOTA2', aliases: ['DOTA2', 'dota2', 'Defense of the Ancients 2'] },
  { english: 'PICO PARK', chinese: 'PICO PARK' },
];

/**
 * 創建遊戲名稱映射表（用於快速查找）
 * key: 標準化的遊戲名稱（小寫，去除特殊字符）
 * value: 標準遊戲對象
 */
const createGameNameMap = () => {
  const map = new Map<string, typeof GAME_LIBRARY[0]>();
  
  GAME_LIBRARY.forEach(game => {
    // 標準化函數：轉小寫，去除空格和特殊字符
    const normalize = (str: string) => str.toLowerCase().replace(/[:\s：]/g, '').trim();
    
    // 添加英文名稱
    const engKey = normalize(game.english);
    map.set(engKey, game);
    
    // 添加中文名稱
    const chiKey = normalize(game.chinese);
    map.set(chiKey, game);
    
    // 添加別名
    if (game.aliases) {
      game.aliases.forEach(alias => {
        const aliasKey = normalize(alias);
        map.set(aliasKey, game);
      });
    }
  });
  
  return map;
};

const gameNameMap = createGameNameMap();

/**
 * 標準化遊戲名稱（用於匹配）
 */
export function normalizeGameName(gameName: string): string {
  return gameName.toLowerCase().replace(/[:\s：]/g, '').trim();
}

/**
 * 檢查遊戲名稱是否在遊戲庫中
 */
export function isGameInLibrary(gameName: string): boolean {
  const normalized = normalizeGameName(gameName);
  return gameNameMap.has(normalized);
}

/**
 * 獲取遊戲的標準名稱（如果存在）
 * 返回格式：{ english: string, chinese: string }
 */
export function getGameStandardName(gameName: string): { english: string; chinese: string } | null {
  const normalized = normalizeGameName(gameName);
  const game = gameNameMap.get(normalized);
  return game ? { english: game.english, chinese: game.chinese } : null;
}

/**
 * 獲取所有遊戲庫中的遊戲名稱（用於顯示）
 */
export function getAllGameNames(): Array<{ english: string; chinese: string }> {
  return GAME_LIBRARY.map(game => ({
    english: game.english,
    chinese: game.chinese
  }));
}

