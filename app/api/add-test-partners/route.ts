import { NextResponse } from 'next/server'
import { db } from '@/lib/db-resilience'
import bcrypt from 'bcryptjs'


export const dynamic = 'force-dynamic';
export async function POST() {
  try {
    // 檢查環境
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: '此操作不允許在生產環境執行' },
        { status: 403 }
      )
    }

    const testPartners = [
      {
        name: '遊戲高手Alex',
        email: 'alex2024@test.com',
        phone: '0911111111',
        birthday: '1995-03-15',
        games: ['英雄聯盟', '傳說對決', '原神'],
        halfHourlyRate: 300,
        customerMessage: '專業上分，保證效率！',
        isRankBooster: true,
        coverImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop'
      },
      {
        name: '電競女神Luna',
        email: 'luna2024@test.com',
        phone: '0922222222',
        birthday: '1998-07-22',
        games: ['英雄聯盟', 'Apex Legends', 'Valorant'],
        halfHourlyRate: 450,
        customerMessage: '溫柔耐心，新手友善！',
        isRankBooster: false,
        coverImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop'
      },
      {
        name: '傳說王者Mike',
        email: 'mike2024@test.com',
        phone: '0933333333',
        birthday: '1993-11-08',
        games: ['傳說對決', '王者榮耀', '英雄聯盟'],
        halfHourlyRate: 600,
        customerMessage: '傳說對決專精，帶你上王者！',
        isRankBooster: true,
        coverImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop'
      },
      {
        name: '原神專家Sara',
        email: 'sara2024@test.com',
        phone: '0944444444',
        birthday: '1996-05-12',
        games: ['原神', '崩壞星穹鐵道', '崩壞3'],
        halfHourlyRate: 250,
        customerMessage: '原神全角色精通，深淵滿星！',
        isRankBooster: false,
        coverImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop'
      },
      {
        name: 'FPS神槍手Tom',
        email: 'tom2024@test.com',
        phone: '0955555555',
        birthday: '1994-09-30',
        games: ['Valorant', 'CS2', 'Apex Legends'],
        halfHourlyRate: 400,
        customerMessage: 'FPS遊戲專家，槍法精準！',
        isRankBooster: true,
        coverImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop'
      },
      {
        name: '手遊達人Emma',
        email: 'emma2024@test.com',
        phone: '0966666666',
        birthday: '1997-12-03',
        games: ['傳說對決', '王者榮耀', 'PUBG Mobile'],
        halfHourlyRate: 350,
        customerMessage: '手遊專精，隨時隨地陪你玩！',
        isRankBooster: false,
        coverImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop'
      },
      {
        name: '策略大師David',
        email: 'david2024@test.com',
        phone: '0977777777',
        birthday: '1992-01-18',
        games: ['英雄聯盟', 'Dota 2', '星海爭霸2'],
        halfHourlyRate: 500,
        customerMessage: '策略遊戲專家，戰術分析強！',
        isRankBooster: true,
        coverImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop'
      },
      {
        name: '萌新導師Lisa',
        email: 'lisa2024@test.com',
        phone: '0988888888',
        birthday: '1999-04-25',
        games: ['英雄聯盟', '傳說對決', '原神'],
        halfHourlyRate: 200,
        customerMessage: '新手友善，耐心教學！',
        isRankBooster: false,
        coverImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop'
      },
      {
        name: '電競老將John',
        email: 'john2024@test.com',
        phone: '0999999999',
        birthday: '1990-08-14',
        games: ['英雄聯盟', '傳說對決', 'Valorant'],
        halfHourlyRate: 700,
        customerMessage: '電競老將，經驗豐富！',
        isRankBooster: true,
        coverImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop'
      },
      {
        name: '遊戲主播Amy',
        email: 'amy2024@test.com',
        phone: '0900000000',
        birthday: '1996-06-20',
        games: ['原神', '英雄聯盟', '傳說對決'],
        halfHourlyRate: 550,
        customerMessage: '知名遊戲主播，娛樂性十足！',
        isRankBooster: false,
        coverImage: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop'
      }
    ]

    const createdPartners = []

    for (const partnerData of testPartners) {
      try {
        // 檢查是否已存在並創建夥伴
        const partner = await db.query(async (client) => {
          // 檢查是否已存在
          const existingUser = await client.user.findUnique({
            where: { email: partnerData.email }
          });

          if (existingUser) {
            throw new Error('USER_EXISTS');
          }

          // 創建用戶
          const password = await bcrypt.hash('test123', 10)
          const user = await client.user.create({
            data: {
              email: partnerData.email,
              password: password,
              name: partnerData.name,
              role: 'PARTNER',
              phone: partnerData.phone,
              birthday: new Date(partnerData.birthday),
            },
          });

          // 創建夥伴資料
          const partnerDataCreated = await client.partner.create({
            data: {
              userId: user.id,
              name: partnerData.name,
              birthday: new Date(partnerData.birthday),
              phone: partnerData.phone,
              coverImage: partnerData.coverImage,
              images: [partnerData.coverImage],
              games: partnerData.games,
              halfHourlyRate: partnerData.halfHourlyRate,
              isAvailableNow: Math.random() > 0.3, // 70% 機率現在有空
              isRankBooster: partnerData.isRankBooster,
              status: 'APPROVED',
              customerMessage: partnerData.customerMessage,
            },
          });

          // 為夥伴創建一些排程
          const today = new Date()
          for (let i = 0; i < 3; i++) {
            const date = new Date(today)
            date.setDate(today.getDate() + i)
            
            // 創建上午時段
            await client.schedule.create({
              data: {
                partnerId: partnerDataCreated.id,
                date: date,
                startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0),
                endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0),
                isAvailable: true,
              },
            });

            // 創建下午時段
            await client.schedule.create({
              data: {
                partnerId: partnerDataCreated.id,
                date: date,
                startTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 14, 0, 0),
                endTime: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 17, 0, 0),
                isAvailable: true,
              },
            });
          }

          return partnerDataCreated;
        });

        createdPartners.push({
          name: partner.name,
          email: partnerData.email,
          password: 'test123',
          games: partner.games,
          halfHourlyRate: partner.halfHourlyRate,
          isAvailableNow: partner.isAvailableNow,
          isRankBooster: partner.isRankBooster
        });

        console.log(`成功創建夥伴: ${partner.name}`);

      } catch (error) {
        if (error instanceof Error && error.message === 'USER_EXISTS') {
          console.log(`用戶 ${partnerData.email} 已存在，跳過`);
          continue;
        }
        console.error(`創建夥伴 ${partnerData.name} 失敗:`, error);
        // 繼續創建其他夥伴
      }
    }

    return NextResponse.json({
      message: `成功創建 ${createdPartners.length} 個測試夥伴！`,
      partners: createdPartners,
      total: createdPartners.length
    })

  } catch (error) {
    console.error('Error creating test partners:', error)
    return NextResponse.json(
      { error: '創建測試夥伴失敗', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
