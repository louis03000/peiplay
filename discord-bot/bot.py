import os
import discord
from discord.ext import tasks, commands
from discord.ui import View, Button, Modal, TextInput
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Boolean, Float, text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, joinedload
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
import threading
from new_booking_flow import (
    check_early_communication_channels,
    check_voice_channel_creation,
    check_extension_buttons,
    check_voice_channel_cleanup,
    check_text_channel_cleanup
)

# --- 環境與資料庫設定 ---
load_dotenv()
TOKEN = os.getenv("DISCORD_BOT_TOKEN")
GUILD_ID = int(os.getenv("DISCORD_GUILD_ID", "0"))
ADMIN_CHANNEL_ID = int(os.getenv("ADMIN_CHANNEL_ID", "0"))
TW_TZ = timezone(timedelta(hours=8))

# 資料庫連接設定
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL 環境變數未設定")

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

# Discord Bot 設定
intents = discord.Intents.default()
intents.message_content = True
intents.guilds = True
intents.voice_states = True
intents.members = True

bot = commands.Bot(command_prefix='!', intents=intents)

# Flask 應用程式設定
app = Flask(__name__)

# 檢查間隔設定
CHECK_INTERVAL = 30  # 30秒檢查一次

# 全局變數
processed_bookings = set()
processed_withdrawals = set()
processed_text_channels = set()
processed_voice_channels = set()

def find_member_by_discord_name(guild, discord_name):
    """根據 Discord 名稱查找成員"""
    for member in guild.members:
        if member.name == discord_name or member.display_name == discord_name:
            return member
    return None

# --- Discord Bot 事件處理 ---
@bot.event
async def on_ready():
    print(f'{bot.user} 已上線！')
    print(f'伺服器 ID: {GUILD_ID}')
    print(f'管理員頻道 ID: {ADMIN_CHANNEL_ID}')
    
    # 啟動所有任務
    check_new_bookings.start()
    check_bookings.start()
    check_missing_ratings.start()
    check_pending_reviews.start()
    check_withdrawal_requests_task.start()
    auto_close_available_now.start()
    cleanup_expired_channels.start()
    database_health_check.start()
    
    print("✅ 所有任務已啟動")

# --- 資料庫連接健康檢查任務 ---
@tasks.loop(seconds=300)  # 每5分鐘檢查一次
async def database_health_check():
    """檢查資料庫連接健康狀態"""
    try:
        with Session() as s:
            # 執行簡單的查詢來測試連接
            s.execute(text("SELECT 1")).fetchone()
        # 如果沒有異常，連接正常
    except Exception as e:
        print(f"⚠️ 資料庫連接健康檢查失敗: {e}")
        # 可以考慮重新初始化連接池
        try:
            engine.dispose()
            print("🔄 已重新初始化資料庫連接池")
        except Exception as dispose_error:
            print(f"❌ 重新初始化資料庫連接池失敗: {dispose_error}")

# --- 檢查新預約任務 ---
@tasks.loop(seconds=CHECK_INTERVAL)
async def check_new_bookings():
    """檢查新確認的預約並創建提前溝通頻道"""
    await bot.wait_until_ready()
    
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return
        
        with Session() as s:
            # 查詢已確認但還沒有提前溝通頻道的新預約
            result = s.execute(text("""
                SELECT 
                    b.id, b."customerId", b."scheduleId", b.status, b."createdAt",
                    c.name as customer_name, cu.discord as customer_discord,
                    p.name as partner_name, pu.discord as partner_discord,
                    s."startTime", s."endTime"
                FROM "Booking" b
                JOIN "Schedule" s ON s.id = b."scheduleId"
                JOIN "Customer" c ON c.id = b."customerId"
                JOIN "User" cu ON cu.id = c."userId"
                JOIN "Partner" p ON p.id = s."partnerId"
                JOIN "User" pu ON pu.id = p."userId"
                WHERE b.status = 'CONFIRMED'
                AND b."discordEarlyTextChannelId" IS NULL
                AND s."startTime" > :current_time
                AND b.id NOT IN :processed_ids
            """), {"current_time": datetime.now(timezone.utc), "processed_ids": tuple(processed_bookings)})
            
            for row in result:
                try:
                    # 創建提前溝通頻道
                    await check_early_communication_channels(guild, datetime.now(timezone.utc))
                    
                    # 標記為已處理
                    processed_bookings.add(row.id)
                    
                except Exception as e:
                    print(f"❌ 處理新預約 {row.id} 時發生錯誤: {e}")
                    continue
                    
    except Exception as e:
        print(f"❌ 檢查新預約時發生錯誤: {e}")

# --- 自動檢查預約任務 ---
@tasks.loop(seconds=CHECK_INTERVAL)
async def check_bookings():
    """定期檢查預約狀態並管理 Discord 頻道"""
    await bot.wait_until_ready()
    
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            print("❌ 找不到 Discord 伺服器")
            return
        
        now = datetime.now(timezone.utc)
        
        # 1. 檢查需要創建提前溝通文字頻道的預約（預約確認後）
        await check_early_communication_channels(guild, now)
        
        # 2. 檢查需要創建語音頻道的預約（開始前5分鐘）
        await check_voice_channel_creation(guild, now)
        
        # 3. 檢查需要顯示延長按鈕的預約（結束前10分鐘）
        await check_extension_buttons(guild, now)
        
        # 4. 檢查需要結束語音頻道的預約（時間結束）
        await check_voice_channel_cleanup(guild, now)
        
        # 5. 檢查需要清理文字頻道的預約（評價完成後）
        await check_text_channel_cleanup(guild, now)
        
    except Exception as e:
        print(f"❌ 檢查預約時發生錯誤: {e}")

# --- 檢查遺失評價任務 ---
@tasks.loop(seconds=300)  # 每5分鐘檢查一次
async def check_missing_ratings():
    """檢查遺失的評價"""
    await bot.wait_until_ready()
    
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            return
        
        with Session() as s:
            # 查詢預約結束超過30分鐘但還沒有評價的預約
            cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=30)
            
            result = s.execute(text("""
                SELECT 
                    b.id, b."customerId", b."scheduleId",
                    c.name as customer_name, p.name as partner_name,
                    s."endTime"
                FROM "Booking" b
                JOIN "Schedule" s ON s.id = b."scheduleId"
                JOIN "Customer" c ON c.id = b."customerId"
                JOIN "Partner" p ON p.id = s."partnerId"
                WHERE b.status = 'COMPLETED'
                AND s."endTime" <= :cutoff_time
                AND b.id NOT IN (
                    SELECT DISTINCT "bookingId" FROM "Review"
                )
            """), {"cutoff_time": cutoff_time})
            
            missing_ratings = result.fetchall()
            
            if missing_ratings:
                admin_channel = guild.get_channel(ADMIN_CHANNEL_ID)
                if admin_channel:
                    for booking in missing_ratings:
                        try:
                            time_since_end = (datetime.now(timezone.utc) - booking.endTime).total_seconds() / 60
                            
                            embed = discord.Embed(
                                title="⚠️ 遺失評價提醒",
                                color=0xff6b6b,
                                timestamp=datetime.now()
                            )
                            embed.add_field(
                                name="預約資訊",
                                value=f"**{booking.customer_name}** 評價 **{booking.partner_name}**\n"
                                      f"⭐ 未評價\n"
                                      f"💬 顧客未填寫評價（預約已結束 {time_since_end:.0f} 分鐘）"
                            )
                            # 已發送遺失評價，減少日誌輸出
                        except Exception as e:
                            print(f"❌ 發送遺失評價失敗: {e}")
                
                # 清除頻道記錄並標記預約為完成，避免重複處理
                booking_ids = [b.id for b in missing_ratings]
                s.execute(text("""
                    UPDATE "Booking" 
                    SET "discordVoiceChannelId" = NULL, "discordTextChannelId" = NULL, status = 'COMPLETED'
                    WHERE id = ANY(:booking_ids)
                """), {"booking_ids": booking_ids})
                
                # 計算推薦收入
                for booking in missing_ratings:
                    try:
                        calculate_referral_earnings(booking.id)
                    except Exception as e:
                        print(f"❌ 計算推薦收入失敗 {booking.id}: {e}")
                s.commit()
                
    except Exception as e:
        print(f"❌ 檢查遺失評價時發生錯誤: {e}")

# --- 檢查待審核項目任務 ---
@tasks.loop(hours=6)
async def check_pending_reviews():
    """檢查待審核的夥伴申請和提領申請，並通知管理員"""
    await bot.wait_until_ready()
    
    try:
        guild = bot.get_guild(GUILD_ID)
        admin_channel = guild.get_channel(ADMIN_CHANNEL_ID)
        
        if not admin_channel:
            print("❌ 找不到管理員頻道")
            return
        
        with Session() as s:
            # 檢查待審核的夥伴申請
            pending_partners_result = s.execute(text("SELECT COUNT(*) FROM \"Partner\" WHERE status = 'PENDING'"))
            pending_partners_count = pending_partners_result.fetchone()[0]
            
            # 檢查待審核的提領申請
            pending_withdrawals_result = s.execute(text("SELECT COUNT(*) FROM \"WithdrawalRequest\" WHERE status = 'PENDING'"))
            pending_withdrawals_count = pending_withdrawals_result.fetchone()[0]
            
            # 如果有待審核項目，發送通知
            if pending_partners_count > 0 or pending_withdrawals_count > 0:
                embed = discord.Embed(
                    title="📋 待審核項目提醒",
                    color=0xffa500,
                    timestamp=datetime.now()
                )
                embed.add_field(name="夥伴申請", value=f"{pending_partners_count} 個待審核", inline=True)
                embed.add_field(name="提領申請", value=f"{pending_withdrawals_count} 個待審核", inline=True)
                embed.add_field(name="提醒時間", value="每6小時檢查一次", inline=False)
                
                await admin_channel.send(embed=embed)
                print(f"✅ 已發送待審核提醒：夥伴申請 {pending_partners_count} 個，提領申請 {pending_withdrawals_count} 個")
            else:
                print("✅ 沒有待審核項目")
                
    except Exception as e:
        print(f"❌ 檢查待審核項目時發生錯誤: {e}")

# --- 檢查提領申請任務 ---
@tasks.loop(seconds=60)  # 每分鐘檢查一次
async def check_withdrawal_requests_task():
    """檢查提領申請任務包裝器"""
    await check_withdrawal_requests()

async def check_withdrawal_requests():
    """檢查新的提領申請並通知管理員"""
    try:
        guild = bot.get_guild(GUILD_ID)
        admin_channel = guild.get_channel(ADMIN_CHANNEL_ID)
        
        if not guild or not admin_channel:
            return
        
        with Session() as s:
            # 查詢新的提領申請
            result = s.execute(text("""
                SELECT w.id, w.amount, w.status, w."requestedAt", w."processedAt", w."adminNote",
                       p.name as partner_name, u.name as user_name
                FROM "WithdrawalRequest" w
                JOIN "Partner" p ON p.id = w."partnerId"
                JOIN "User" u ON u.id = p."userId"
                WHERE w.id NOT IN :processed_ids
                ORDER BY w."requestedAt" DESC
            """), {"processed_ids": tuple(processed_withdrawals)})
            
            for row in result:
                try:
                    embed = discord.Embed(
                        title="💰 新的提領申請",
                        color=0x00ff88,
                        timestamp=row.requestedAt
                    )
                    embed.add_field(name="夥伴", value=row.partner_name, inline=True)
                    embed.add_field(name="用戶", value=row.user_name, inline=True)
                    embed.add_field(name="金額", value=f"NT$ {row.amount:,.0f}", inline=True)
                    embed.add_field(name="狀態", value=row.status, inline=True)
                    embed.add_field(name="申請時間", value=row.requestedAt.strftime("%Y/%m/%d %H:%M"), inline=True)
                    if row.adminNote:
                        embed.add_field(name="管理員備註", value=row.adminNote, inline=False)
                    
                    await admin_channel.send(embed=embed)
                    
                    # 標記為已處理
                    processed_withdrawals.add(row.id)
                    # 已發送提領申請通知，減少日誌輸出
                    
                except Exception as e:
                    print(f"❌ 處理提領申請 {row.id} 時發生錯誤: {e}")
                    continue
                    
    except Exception as e:
        print(f"❌ 檢查提領申請時發生錯誤: {e}")

# --- 自動關閉「現在有空」狀態任務 ---
@tasks.loop(seconds=60)  # 每1分鐘檢查一次
async def auto_close_available_now():
    """自動關閉超過1小時的「現在有空」狀態"""
    await bot.wait_until_ready()
    
    try:
        with Session() as s:
            # 查詢超過1小時的「現在有空」狀態
            cutoff_time = datetime.now(timezone.utc) - timedelta(hours=1)
            
            result = s.execute(text("""
                SELECT id, name, "availableNowSince"
                FROM "Partner"
                WHERE "isAvailableNow" = true
                AND "availableNowSince" < :cutoff_time
            """), {"cutoff_time": cutoff_time})
            
            expired_partners = result.fetchall()
            
            if expired_partners:
                # 批量更新
                partner_ids = [p.id for p in expired_partners]
                s.execute(text("""
                    UPDATE "Partner"
                    SET "isAvailableNow" = false, "availableNowSince" = NULL
                    WHERE id = ANY(:partner_ids)
                """), {"partner_ids": partner_ids})
                s.commit()
                
                print(f"✅ 已自動關閉 {len(expired_partners)} 個過期的「現在有空」狀態:")
                for partner in expired_partners:
                    print(f"   - {partner.name} (ID: {partner.id})")
            else:
                pass  # 沒有需要關閉的狀態，不輸出日誌
                
    except Exception as e:
        print(f"❌ 自動關閉「現在有空」狀態時發生錯誤: {e}")

# --- 清理過期頻道任務 ---
@tasks.loop(seconds=60)  # 每1分鐘檢查一次
async def cleanup_expired_channels():
    """清理過期的頻道"""
    await bot.wait_until_ready()
    
    try:
        guild = bot.get_guild(GUILD_ID)
        if not guild:
            return
        
        with Session() as s:
            # 查詢過期的頻道（結束時間超過30分鐘）
            cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=30)
            
            result = s.execute(text("""
                SELECT id, "discordTextChannelId", "discordVoiceChannelId"
                FROM "Booking"
                WHERE "discordTextChannelId" IS NOT NULL
                AND "scheduleId" IN (
                    SELECT id FROM "Schedule" WHERE "endTime" < :cutoff_time
                )
            """), {"cutoff_time": cutoff_time})
            
            for row in result:
                booking_id = row.id
                text_channel_id = row.discordTextChannelId
                voice_channel_id = row.discordVoiceChannelId
                
                deleted_channels = []
                
                # 刪除文字頻道
                if text_channel_id:
                    try:
                        text_channel = guild.get_channel(int(text_channel_id))
                        if text_channel:
                            await text_channel.delete()
                            deleted_channels.append(f"文字頻道 {text_channel.name}")
                            # 已清理過期文字頻道，減少日誌輸出
                    except Exception as e:
                        print(f"❌ 清理文字頻道失敗: {e}")
                
                # 刪除語音頻道
                if voice_channel_id:
                    try:
                        voice_channel = guild.get_channel(int(voice_channel_id))
                        if voice_channel:
                            await voice_channel.delete()
                            deleted_channels.append(f"語音頻道 {voice_channel.name}")
                            # 已清理過期語音頻道，減少日誌輸出
                    except Exception as e:
                        print(f"❌ 清理語音頻道失敗: {e}")
                
                # 清除資料庫中的頻道 ID
                if deleted_channels:
                    try:
                        s.execute(text("""
                            UPDATE "Booking" 
                            SET "discordTextChannelId" = NULL, "discordVoiceChannelId" = NULL 
                            WHERE id = :booking_id
                        """), {"booking_id": booking_id})
                        s.commit()
                        # 已清除預約的頻道ID，減少日誌輸出
                    except Exception as e:
                        print(f"❌ 清除頻道 ID 失敗: {e}")
        
    except Exception as e:
        print(f"❌ 清理過期頻道時發生錯誤: {e}")

# --- 推薦收入計算函數 ---
def calculate_referral_earnings(booking_id):
    """計算推薦收入"""
    try:
        import requests
        response = requests.post(
            'http://localhost:3000/api/partners/referral/calculate-earnings',
            json={'bookingId': booking_id},
            timeout=10
        )
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 推薦收入計算完成: {booking_id}")
            if result.get('referralEarning', 0) > 0:
                print(f"💰 推薦收入: NT$ {result['referralEarning']:.2f} (來自: {result['inviter']['name']})")
        else:
            print(f"⚠️ 推薦收入計算失敗: {booking_id} - {response.status_code}")
    except Exception as e:
        print(f"❌ 計算推薦收入時發生錯誤: {e}")

# --- Flask 路由 ---
@app.route('/create_instant_text_channel', methods=['POST'])
def create_instant_text_channel():
    """創建即時預約文字頻道"""
    try:
        data = request.get_json()
        booking_id = data.get('bookingId')
        
        if not booking_id:
            return jsonify({'error': '缺少 bookingId 參數'}), 400
        
        print(f"🔍 收到即時預約文字頻道創建請求: {booking_id}")
        
        # 這裡可以添加創建即時預約文字頻道的邏輯
        # 由於現在使用新的流程，這個端點可能不再需要
        
        return jsonify({'success': True, 'message': '即時預約文字頻道創建請求已收到'})
        
    except Exception as e:
        return jsonify({'error': f'創建即時預約文字頻道失敗: {str(e)}'}), 500

@app.route('/invite_user', methods=['POST'])
def invite_user_to_discord():
    """邀請用戶加入 Discord 伺服器"""
    try:
        data = request.get_json()
        discord_name = data.get('discord_name')
        user_name = data.get('user_name')
        user_email = data.get('user_email')
        
        if not all([discord_name, user_name, user_email]):
            return jsonify({'error': '缺少必要參數'}), 400
        
        print(f"🔍 收到邀請請求: {discord_name} ({user_name})")
        
        async def invite_user():
            try:
                guild = bot.get_guild(GUILD_ID)
                if not guild:
                    print("❌ 找不到 Discord 伺服器")
                    return {"error": "找不到 Discord 伺服器"}
                
                member = find_member_by_discord_name(guild, discord_name)
                if not member:
                    print(f"❌ 找不到 Discord 用戶: {discord_name}")
                    
                    admin_channel = guild.get_channel(ADMIN_CHANNEL_ID)
                    if admin_channel:
                        embed = discord.Embed(
                            title="🚨 需要手動邀請用戶",
                            color=0xff6b6b,
                            timestamp=datetime.now()
                        )
                        embed.add_field(name="用戶資訊", value=f"**姓名:** {user_name}\n**Email:** {user_email}\n**Discord:** {discord_name}", inline=False)
                        embed.add_field(name="狀態", value="❌ 找不到該 Discord 用戶", inline=False)
                        embed.add_field(name="建議", value="請手動邀請用戶加入伺服器，或確認 Discord 用戶名是否正確", inline=False)
                        
                        await admin_channel.send(embed=embed)
                    
                    return {"error": f"找不到 Discord 用戶 {discord_name}，已通知管理員手動邀請"}
                
                print(f"✅ 找到用戶: {member.name} ({member.id})")
                
                welcome_channel = guild.get_channel(ADMIN_CHANNEL_ID)  # 使用管理員頻道作為歡迎頻道
                if welcome_channel:
                    embed = discord.Embed(
                        title="🎉 歡迎新用戶加入！",
                        color=0x00ff88,
                        timestamp=datetime.now()
                    )
                    embed.add_field(name="用戶資訊", value=f"**姓名:** {user_name}\n**Email:** {user_email}\n**Discord:** {member.mention}", inline=False)
                    embed.add_field(name="歡迎", value=f"歡迎 {member.mention} 加入 PeiPlay 社群！\n請查看頻道說明並開始您的遊戲夥伴之旅！", inline=False)
                    
                    await welcome_channel.send(embed=embed)
                
                return {"success": True, "message": f"用戶 {member.name} 已在伺服器中，已發送歡迎訊息"}
                
            except Exception as e:
                print(f"❌ 邀請用戶時發生錯誤: {e}")
                return {"error": str(e)}
        
        # 使用 asyncio 運行 Discord 操作
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(invite_user())
            loop.close()
            return jsonify(result)
        except Exception as e:
            loop.close()
            return jsonify({'error': f'Discord 操作失敗: {str(e)}'}), 500
            
    except Exception as e:
        return jsonify({'error': f'邀請用戶失敗: {str(e)}'}), 500

def run_flask():
    app.run(host="0.0.0.0", port=5001)

threading.Thread(target=run_flask, daemon=True).start()
bot.run(TOKEN)
