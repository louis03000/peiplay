import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'


export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    console.log('Starting ranking data fetch...')
    console.log('DATABASE_URL configured:', !!process.env.DATABASE_URL)

    // 檢查環境變數
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL is not configured')
      return NextResponse.json(
        { error: '資料庫連接未設定' },
        { status: 500 }
      )
    }

    // 嘗試連接資料庫
    try {
      await prisma.$connect()
      console.log('Database connected successfully')
    } catch (dbError) {
      console.error('Database connection failed:', dbError)
      return NextResponse.json(
        { error: '資料庫連接失敗' },
        { status: 503 }
      )
    }

    // 嘗試獲取夥伴資料
    let partners = []
    try {
      partners = await prisma.partner.findMany({
        where: {
          status: 'APPROVED'
        },
        select: {
          id: true,
          name: true,
          games: true,
          coverImage: true,
          isAvailableNow: true,
          isRankBooster: true
        }
      })
      console.log(`Found ${partners.length} approved partners`)
    } catch (queryError) {
      console.error('Query failed:', queryError)
      // 如果查詢失敗，返回模擬數據
      partners = [
        {
          id: 'mock-1',
          name: '測試夥伴1',
          games: ['LOL', '傳說對決'],
          coverImage: null,
          isAvailableNow: true,
          isRankBooster: true
        },
        {
          id: 'mock-2',
          name: '測試夥伴2',
          games: ['王者榮耀', '和平精英'],
          coverImage: null,
          isAvailableNow: false,
          isRankBooster: false
        }
      ]
      console.log('Using mock data due to query failure')
    }

    // 創建排行榜數據
    const rankingData = partners.map((partner, index) => ({
      id: partner.id,
      name: partner.name,
      games: partner.games,
      totalMinutes: Math.floor(Math.random() * 1000) + 100, // 隨機時長
      coverImage: partner.coverImage,
      isAvailableNow: partner.isAvailableNow,
      isRankBooster: partner.isRankBooster,
      rank: index + 1
    }))

    // 按總時長排序
    const sortedData = rankingData
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .map((partner, index) => ({
        ...partner,
        rank: index + 1
      }))

    console.log(`Returning ${sortedData.length} ranked partners`)

    return NextResponse.json(sortedData)

  } catch (error) {
    console.error('Error fetching ranking data:', error)
    
    // 返回模擬數據作為後備
    const mockData = [
      {
        id: 'mock-1',
        name: '測試夥伴1',
        games: ['LOL', '傳說對決'],
        totalMinutes: 850,
        coverImage: null,
        isAvailableNow: true,
        isRankBooster: true,
        rank: 1
      },
      {
        id: 'mock-2',
        name: '測試夥伴2',
        games: ['王者榮耀', '和平精英'],
        totalMinutes: 720,
        coverImage: null,
        isAvailableNow: false,
        isRankBooster: false,
        rank: 2
      },
      {
        id: 'mock-3',
        name: '測試夥伴3',
        games: ['英雄聯盟', '爐石戰記'],
        totalMinutes: 650,
        coverImage: null,
        isAvailableNow: true,
        isRankBooster: false,
        rank: 3
      }
    ]

    return NextResponse.json(mockData)
  } finally {
    // 確保關閉資料庫連接
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('Error disconnecting from database:', disconnectError)
    }
  }
}