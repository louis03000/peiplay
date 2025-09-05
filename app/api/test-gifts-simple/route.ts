import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // 簡單的測試，不依賴資料庫
  return NextResponse.json({
    success: true,
    message: '送禮物功能測試',
    gifts: [
      { id: '1', name: '玫瑰', emoji: '🌹', coinCost: 10 },
      { id: '2', name: '愛心', emoji: '❤️', coinCost: 20 },
      { id: '3', name: '星星', emoji: '⭐', coinCost: 50 },
      { id: '4', name: '皇冠', emoji: '👑', coinCost: 100 },
      { id: '5', name: '鑽石', emoji: '💎', coinCost: 200 },
      { id: '6', name: '火箭', emoji: '🚀', coinCost: 500 },
      { id: '7', name: '彩虹', emoji: '🌈', coinCost: 1000 }
    ],
    users: [
      { id: 'user1', name: '測試用戶1', email: 'test1@example.com' },
      { id: 'user2', name: '測試用戶2', email: 'test2@example.com' },
      { id: 'user3', name: '測試用戶3', email: 'test3@example.com' }
    ]
  })
}

export async function POST(request: NextRequest) {
  const { receiverId, giftName } = await request.json()
  
  return NextResponse.json({
    success: true,
    message: `✅ 成功贈送 ${giftName} 給用戶 ${receiverId}！`,
    gift: {
      name: giftName,
      emoji: '🎁',
      coins: 100,
      partnerEarned: 80
    }
  })
}
