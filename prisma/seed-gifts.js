const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('開始創建禮物資料...')

  // 創建禮物項目
  const gifts = [
    {
      name: '玫瑰',
      emoji: '🌹',
      coinCost: 10,
      partnerShare: 0.7,
      platformShare: 0.3
    },
    {
      name: '愛心',
      emoji: '❤️',
      coinCost: 20,
      partnerShare: 0.7,
      platformShare: 0.3
    },
    {
      name: '星星',
      emoji: '⭐',
      coinCost: 50,
      partnerShare: 0.7,
      platformShare: 0.3
    },
    {
      name: '皇冠',
      emoji: '👑',
      coinCost: 100,
      partnerShare: 0.7,
      platformShare: 0.3
    },
    {
      name: '鑽石',
      emoji: '💎',
      coinCost: 200,
      partnerShare: 0.7,
      platformShare: 0.3
    },
    {
      name: '火箭',
      emoji: '🚀',
      coinCost: 500,
      partnerShare: 0.7,
      platformShare: 0.3
    },
    {
      name: '彩虹',
      emoji: '🌈',
      coinCost: 1000,
      partnerShare: 0.7,
      platformShare: 0.3
    }
  ]

  for (const gift of gifts) {
    await prisma.giftItem.upsert({
      where: { name: gift.name },
      update: gift,
      create: gift
    })
    console.log(`✅ 禮物 ${gift.name} 創建成功`)
  }

  console.log('🎉 所有禮物資料創建完成！')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
