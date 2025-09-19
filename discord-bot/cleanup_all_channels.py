#!/usr/bin/env python3
"""
手動清理所有過期頻道的腳本
用於立即清理現有的過期頻道
"""

import asyncio
import discord
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv
from datetime import datetime, timezone

# 載入環境變數
load_dotenv()

TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0"))
POSTGRES_CONN = os.getenv("POSTGRES_CONN")
ADMIN_CHANNEL_ID = int(os.getenv("ADMIN_CHANNEL_ID", "0"))

# 資料庫連接
engine = create_engine(POSTGRES_CONN)
Session = sessionmaker(bind=engine)

async def cleanup_all_expired_channels():
    """清理所有過期的預約頻道"""
    try:
        # 初始化 Discord 客戶端
        intents = discord.Intents.default()
        intents.message_content = True
        client = discord.Client(intents=intents)
        
        await client.login(TOKEN)
        
        guild = client.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            await client.close()
            return False
        
        print(f"🔍 開始清理過期頻道...")
        
        # 查詢所有有頻道 ID 的預約
        with Session() as s:
            all_channels_query = """
            SELECT 
                b.id, b."discordTextChannelId", b."discordVoiceChannelId",
                s."endTime", b.status, b."createdAt"
            FROM "Booking" b
            JOIN "Schedule" s ON s.id = b."scheduleId"
            WHERE (b."discordTextChannelId" IS NOT NULL OR b."discordVoiceChannelId" IS NOT NULL)
            ORDER BY b."createdAt" DESC
            """
            
            all_bookings = s.execute(text(all_channels_query)).fetchall()
            
            print(f"📊 找到 {len(all_bookings)} 個有頻道的預約")
            
            now = datetime.now(timezone.utc)
            deleted_count = 0
            
            for booking in all_bookings:
                booking_id = booking.id
                text_channel_id = booking.discordTextChannelId
                voice_channel_id = booking.discordVoiceChannelId
                end_time = booking.endTime
                status = booking.status
                created_at = booking.createdAt
                
                # 判斷是否應該清理
                should_cleanup = False
                reason = ""
                
                if end_time < now:
                    should_cleanup = True
                    reason = f"已過期 (結束時間: {end_time.strftime('%Y-%m-%d %H:%M:%S')})"
                elif status in ['CANCELLED', 'REJECTED']:
                    should_cleanup = True
                    reason = f"狀態為 {status}"
                
                if should_cleanup:
                    print(f"🗑️ 清理預約 {booking_id}: {reason}")
                    
                    deleted_channels = []
                    
                    # 刪除文字頻道
                    if text_channel_id:
                        try:
                            text_channel = guild.get_channel(int(text_channel_id))
                            if text_channel:
                                await text_channel.delete()
                                deleted_channels.append(f"文字頻道 {text_channel.name}")
                                print(f"  ✅ 已刪除文字頻道: {text_channel.name}")
                            else:
                                print(f"  ⚠️ 文字頻道 {text_channel_id} 不存在")
                        except Exception as e:
                            print(f"  ❌ 刪除文字頻道失敗: {e}")
                    
                    # 刪除語音頻道
                    if voice_channel_id:
                        try:
                            voice_channel = guild.get_channel(int(voice_channel_id))
                            if voice_channel:
                                await voice_channel.delete()
                                deleted_channels.append(f"語音頻道 {voice_channel.name}")
                                print(f"  ✅ 已刪除語音頻道: {voice_channel.name}")
                            else:
                                print(f"  ⚠️ 語音頻道 {voice_channel_id} 不存在")
                        except Exception as e:
                            print(f"  ❌ 刪除語音頻道失敗: {e}")
                    
                    # 清除資料庫中的頻道 ID
                    if deleted_channels:
                        try:
                            s.execute(
                                text("UPDATE \"Booking\" SET \"discordTextChannelId\" = NULL, \"discordVoiceChannelId\" = NULL WHERE id = :booking_id"),
                                {"booking_id": booking_id}
                            )
                            s.commit()
                            print(f"  ✅ 已清除預約 {booking_id} 的頻道 ID")
                            deleted_count += 1
                        except Exception as e:
                            print(f"  ❌ 清除頻道 ID 失敗: {e}")
                else:
                    print(f"⏳ 保留預約 {booking_id}: 狀態 {status}, 結束時間 {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        
        print(f"\n🎉 清理完成！共清理了 {deleted_count} 個預約的頻道")
        
        # 通知管理員
        try:
            admin_channel = guild.get_channel(ADMIN_CHANNEL_ID)
            if admin_channel:
                await admin_channel.send(
                    f"🧹 **手動清理完成**\n"
                    f"共清理了 {deleted_count} 個過期預約的頻道\n"
                    f"清理時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                )
        except Exception as notify_error:
            print(f"❌ 發送清理通知失敗: {notify_error}")
        
        await client.close()
        return True
        
    except Exception as error:
        print(f"❌ 清理過期頻道失敗: {error}")
        try:
            await client.close()
        except:
            pass
        return False

if __name__ == "__main__":
    print("🧹 PeiPlay Discord 頻道清理工具")
    print("=" * 50)
    print("⚠️  此腳本將清理所有過期的預約頻道")
    print("⚠️  請確保 Discord Bot 有管理頻道的權限")
    print("=" * 50)
    
    # 執行清理
    result = asyncio.run(cleanup_all_expired_channels())
    
    if result:
        print("\n✅ 清理完成！")
    else:
        print("\n❌ 清理失敗！")
