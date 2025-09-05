const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkUserCoins() {
  try {
    console.log('🔍 檢查所有用戶的金幣餘額...\n')
    
    // 獲取所有有金幣記錄的用戶
    const usersWithCoins = await prisma.userCoins.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: {
        coinBalance: 'desc'
      }
    })

    if (usersWithCoins.length === 0) {
      console.log('❌ 沒有找到任何有金幣的用戶')
      return
    }

    console.log('📊 用戶金幣餘額：')
    console.log('=' .repeat(60))
    
    usersWithCoins.forEach((userCoin, index) => {
      console.log(`${index + 1}. 用戶: ${userCoin.user.name || '未設定'}`)
      console.log(`   信箱: ${userCoin.user.email}`)
      console.log(`   角色: ${userCoin.user.role}`)
      console.log(`   金幣餘額: ${userCoin.coinBalance} 金幣`)
      console.log(`   總儲值: ${userCoin.totalRecharged} 金幣`)
      console.log(`   用戶ID: ${userCoin.user.id}`)
      console.log('-'.repeat(40))
    })

    // 獲取所有用戶（包括沒有金幣記錄的）
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        userCoins: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log('\n👥 所有用戶列表：')
    console.log('=' .repeat(60))
    
    allUsers.forEach((user, index) => {
      const coinBalance = user.userCoins?.coinBalance || 0
      const hasCoins = coinBalance > 0 ? '🪙' : '❌'
      
      console.log(`${index + 1}. ${hasCoins} ${user.name || '未設定'} (${user.email})`)
      console.log(`   角色: ${user.role} | 金幣: ${coinBalance} | ID: ${user.id}`)
    })

  } catch (error) {
    console.error('❌ 檢查失敗:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUserCoins()
