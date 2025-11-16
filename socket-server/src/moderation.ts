import dotenv from 'dotenv';

dotenv.config();

// 關鍵字過濾列表（中文）
const PROHIBITED_KEYWORDS = [
  // 性交易相關
  '約炮', '援交', '包養', '包養', '外送', '全套', '半套',
  // 18禁內容
  '色情', '成人', 'AV', 'A片', 'H漫',
  // 私底下接單
  '私下', '私接', '直接聯繫', '跳過平台', '不透過平台', '私下交易',
  '加LINE', '加微信', '加IG', '加Telegram', '加WhatsApp',
  // 其他違規
  '詐騙', '騙錢', '假帳號',
];

// 可疑關鍵字（需要標記）
const SUSPICIOUS_KEYWORDS = [
  '現金', '轉帳', '匯款', '銀行', '帳號',
  '見面', '約見', '約會', '私下見',
];

interface ModerationResult {
  status: 'APPROVED' | 'REJECTED' | 'FLAGGED' | 'PENDING';
  reason?: string;
  score?: number;
}

/**
 * 內容審查：關鍵字過濾 + OpenAI Moderation API
 */
export async function moderateMessage(content: string): Promise<ModerationResult> {
  const lowerContent = content.toLowerCase();

  // 1. 關鍵字過濾（直接拒絕）
  for (const keyword of PROHIBITED_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      return {
        status: 'REJECTED',
        reason: `訊息包含違規關鍵字：${keyword}`,
        score: 1.0,
      };
    }
  }

  // 2. 可疑關鍵字（標記）
  let suspiciousCount = 0;
  for (const keyword of SUSPICIOUS_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      suspiciousCount++;
    }
  }

  if (suspiciousCount >= 2) {
    return {
      status: 'FLAGGED',
      reason: '訊息包含多個可疑關鍵字，需要人工審查',
      score: 0.7,
    };
  }

  // 3. OpenAI Moderation API（如果配置了）
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey) {
    try {
      const moderationResult = await checkOpenAIModeration(content, openaiApiKey);
      if (moderationResult.status !== 'APPROVED') {
        return moderationResult;
      }
    } catch (error) {
      console.error('OpenAI Moderation API error:', error);
      // 如果 API 失敗，繼續使用關鍵字過濾結果
    }
  }

  // 4. 通過審查
  return {
    status: 'APPROVED',
    score: 0.0,
  };
}

/**
 * 使用 OpenAI Moderation API 檢查內容
 */
async function checkOpenAIModeration(
  content: string,
  apiKey: string
): Promise<ModerationResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: content,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = data.results[0];

    // 檢查是否被標記
    if (result.flagged) {
      const categories = result.categories;
      const scores = result.category_scores;

      // 檢查嚴重類別
      if (categories.sexual || categories.sexual_minors) {
        return {
          status: 'REJECTED',
          reason: '內容包含不當性內容',
          score: scores.sexual || scores.sexual_minors || 0.9,
        };
      }

      if (categories.harassment || categories.harassment_threatening) {
        return {
          status: 'REJECTED',
          reason: '內容包含騷擾或威脅',
          score: scores.harassment || scores.harassment_threatening || 0.9,
        };
      }

      // 其他類別標記為可疑
      return {
        status: 'FLAGGED',
        reason: '內容需要人工審查',
        score: result.category_scores.sexual || 0.5,
      };
    }

    return {
      status: 'APPROVED',
      score: 0.0,
    };
  } catch (error) {
    console.error('OpenAI Moderation API error:', error);
    // 如果 API 失敗，返回待審查狀態
    return {
      status: 'PENDING',
      reason: '審查服務暫時不可用',
    };
  }
}

