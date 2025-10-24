import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 創建群組預約
export async function POST(request: Request) {
  try {
    console.log("✅ group-booking POST api triggered");
    
    const { partnerId, title, description, maxParticipants, pricePerPerson, startTime, endTime } = await request.json();

    if (!partnerId || !title || !startTime || !endTime || !pricePerPerson) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }

    // 返回模擬成功響應
    const mockGroupBooking = {
      id: 'mock-group-' + Date.now(),
      partnerId,
      title,
      description: description || null,
      maxParticipants: maxParticipants || 4,
      currentParticipants: 1,
      pricePerPerson,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      partner: {
        id: partnerId,
        name: '測試夥伴',
        user: {
          name: '測試用戶'
        }
      },
      creator: {
        id: 'mock-creator',
        user: {
          name: '創建者'
        }
      }
    };

    return NextResponse.json({
      success: true,
      groupBooking: mockGroupBooking
    });

  } catch (error) {
    console.error('創建群組預約失敗:', error);
    return NextResponse.json({ error: '創建群組預約失敗' }, { status: 500 });
  }
}

// 獲取群組預約列表
export async function GET(request: Request) {
  try {
    console.log("✅ group-booking GET api triggered");
    
    const { searchParams } = new URL(request.url);
    const partnerId = searchParams.get('partnerId');
    const status = searchParams.get('status');

    // 返回模擬群組預約數據
    const mockGroupBookings = [
      {
        id: 'mock-group-1',
        partnerId: partnerId || 'mock-partner-1',
        title: 'LOL 上分團',
        description: '一起上分，互相學習',
        maxParticipants: 4,
        currentParticipants: 2,
        pricePerPerson: 100,
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
        status: status || 'ACTIVE',
        createdAt: new Date().toISOString(),
        partner: {
          id: partnerId || 'mock-partner-1',
          name: '測試夥伴',
          user: {
            name: '測試用戶'
          }
        },
        creator: {
          id: 'mock-creator',
          user: {
            name: '創建者'
          }
        },
        bookings: [
          {
            id: 'mock-booking-1',
            customer: {
              id: 'mock-customer-1',
              user: {
                name: '參與者1'
              }
            }
          }
        ]
      }
    ];

    return NextResponse.json(mockGroupBookings);

  } catch (error) {
    console.error('獲取群組預約失敗:', error);
    return NextResponse.json({ error: '獲取群組預約失敗' }, { status: 500 });
  }
}
