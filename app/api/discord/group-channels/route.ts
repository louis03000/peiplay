import { NextResponse } from 'next/server';
import { db } from '@/lib/db-resilience';

export const dynamic = 'force-dynamic';

// Discord 群組頻道自動化
export async function POST(request: Request) {
  try {
    const { groupBookingId, action } = await request.json();

    if (!groupBookingId || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 獲取群組預約信息
    const groupBooking = await db.query(async (client) => {
      return await client.groupBooking.findUnique({
        where: { id: groupBookingId },
        include: {
          GroupBookingParticipant: {
            include: {
              Partner: {
                include: { user: true }
              }
            }
          },
          bookings: {
            include: {
              customer: {
                include: { user: true }
              }
            }
          }
        }
      });
    });

    if (!groupBooking) {
      return NextResponse.json({ error: 'Group booking not found' }, { status: 404 });
    }

    // 收集所有參與者的 Discord ID
    const participants = [
      ...groupBooking.GroupBookingParticipant
        .filter(p => p.Partner)
        .map(p => p.Partner!.user.discord),
      ...groupBooking.bookings.map(booking => booking.customer.user.discord)
    ].filter((discord): discord is string => discord !== null && discord !== undefined); // 過濾掉空的 Discord ID

    if (participants.length === 0) {
      return NextResponse.json({ error: 'No participants with Discord IDs' }, { status: 400 });
    }

    let channelId = null;

    if (action === 'create_text_channel') {
      // 創建文字頻道（開始前30分鐘）
      channelId = await createDiscordTextChannel(groupBooking, participants);
    } else if (action === 'create_voice_channel') {
      // 創建語音頻道（開始前3分鐘）
      channelId = await createDiscordVoiceChannel(groupBooking, participants);
    } else if (action === 'delete_channels') {
      // 刪除頻道（結束後）
      await deleteDiscordChannels(groupBooking);
    }

    // 更新群組預約的頻道 ID
    if (channelId && action !== 'delete_channels') {
      const updateData: any = {};
      if (action === 'create_text_channel') {
        updateData.discordTextChannelId = channelId;
      } else if (action === 'create_voice_channel') {
        updateData.discordVoiceChannelId = channelId;
      }

      await db.query(async (client) => {
        return await client.groupBooking.update({
          where: { id: groupBookingId },
          data: updateData
        });
      });
    }

    return NextResponse.json({
      success: true,
      channelId,
      participants: participants.length
    });

  } catch (error) {
    console.error('Discord automation error:', error);
    return NextResponse.json({ error: 'Discord automation failed' }, { status: 500 });
  }
}

// 創建 Discord 文字頻道
async function createDiscordTextChannel(groupBooking: any, participants: string[]) {
  try {
    const response = await fetch('http://localhost:5001/create-group-text-channel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 你的密鑰'
      },
      body: JSON.stringify({
        groupId: groupBooking.id,
        groupTitle: groupBooking.title,
        participants: participants,
        startTime: groupBooking.startTime,
        endTime: groupBooking.endTime
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.channelId;
    }
  } catch (error) {
    console.error('Error creating Discord text channel:', error);
  }
  return null;
}

// 創建 Discord 語音頻道
async function createDiscordVoiceChannel(groupBooking: any, participants: string[]) {
  try {
    const response = await fetch('http://localhost:5001/create-group-voice-channel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 你的密鑰'
      },
      body: JSON.stringify({
        groupId: groupBooking.id,
        groupTitle: groupBooking.title,
        participants: participants,
        startTime: groupBooking.startTime
      })
    });

    if (response.ok) {
      const data = await response.json();
      return data.channelId;
    }
  } catch (error) {
    console.error('Error creating Discord voice channel:', error);
  }
  return null;
}

// 刪除 Discord 頻道
async function deleteDiscordChannels(groupBooking: any) {
  try {
    if (groupBooking.discordTextChannelId) {
      await fetch('http://localhost:5001/delete-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 你的密鑰'
        },
        body: JSON.stringify({
          channelId: groupBooking.discordTextChannelId
        })
      });
    }

    if (groupBooking.discordVoiceChannelId) {
      await fetch('http://localhost:5001/delete-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 你的密鑰'
        },
        body: JSON.stringify({
          channelId: groupBooking.discordVoiceChannelId
        })
      });
    }

    // 清除頻道 ID
    await db.query(async (client) => {
      return await client.groupBooking.update({
        where: { id: groupBooking.id },
        data: {
          discordTextChannelId: null,
          discordVoiceChannelId: null
        }
      });
    });
  } catch (error) {
    console.error('Error deleting Discord channels:', error);
  }
}
