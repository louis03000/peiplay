import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 群組預約狀態自動管理
export async function GET() {
  try {
    const now = new Date();
    
    // 1. 處理開始前30分鐘的群組（關閉群組，創建文字頻道）
    const thirtyMinutesFromNow = new Date(now.getTime() + 30 * 60 * 1000);
    const groupsToClose = await prisma.groupBooking.findMany({
      where: {
        status: 'ACTIVE',
        startTime: {
          lte: thirtyMinutesFromNow,
          gt: now
        }
      },
      include: {
        bookings: {
          include: {
            customer: {
              include: { user: true }
            }
          }
        }
      }
    });

    for (const group of groupsToClose) {
      // 關閉群組（不再接受新成員）
      await prisma.groupBooking.update({
        where: { id: group.id },
        data: { status: 'CLOSED' }
      });

      // 創建文字頻道
      try {
        await fetch(`${process.env.NEXTAUTH_URL}/api/discord/group-channels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupBookingId: group.id,
            action: 'create_text_channel'
          })
        });
      } catch (error) {
        console.error('Error creating text channel for group:', group.id, error);
      }
    }

    // 2. 處理開始前3分鐘的群組（創建語音頻道）
    const threeMinutesFromNow = new Date(now.getTime() + 3 * 60 * 1000);
    const groupsForVoice = await prisma.groupBooking.findMany({
      where: {
        status: 'CLOSED',
        startTime: {
          lte: threeMinutesFromNow,
          gt: now
        },
        discordTextChannelId: { not: null },
        discordVoiceChannelId: null
      }
    });

    for (const group of groupsForVoice) {
      // 創建語音頻道
      try {
        await fetch(`${process.env.NEXTAUTH_URL}/api/discord/group-channels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupBookingId: group.id,
            action: 'create_voice_channel'
          })
        });
      } catch (error) {
        console.error('Error creating voice channel for group:', group.id, error);
      }
    }

    // 3. 處理已結束的群組（刪除頻道，標記為完成）
    const endedGroups = await prisma.groupBooking.findMany({
      where: {
        status: { in: ['CLOSED', 'ACTIVE'] },
        endTime: { lte: now }
      }
    });

    for (const group of endedGroups) {
      // 刪除 Discord 頻道
      try {
        await fetch(`${process.env.NEXTAUTH_URL}/api/discord/group-channels`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupBookingId: group.id,
            action: 'delete_channels'
          })
        });
      } catch (error) {
        console.error('Error deleting channels for group:', group.id, error);
      }

      // 標記為完成
      await prisma.groupBooking.update({
        where: { id: group.id },
        data: { status: 'COMPLETED' }
      });
    }

    return NextResponse.json({
      success: true,
      closed: groupsToClose.length,
      voiceChannels: groupsForVoice.length,
      completed: endedGroups.length
    });

  } catch (error) {
    console.error('Group booking status automation error:', error);
    return NextResponse.json({ error: 'Automation failed' }, { status: 500 });
  }
}
