# Discord 預約流程管理
import discord
from discord.ext import tasks
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import hashlib
import re

# 導入現有的配置和函數
from bot import (
    TW_TZ, GUILD_ID, ADMIN_CHANNEL_ID, 
    find_member_by_discord_name, Session,
    calculate_referral_earnings
)

async def check_early_communication_channels(guild, now):
    """檢查需要創建提前溝通文字頻道的預約（預約確認後立即創建）"""
    try:
        with Session() as s:
            # 查詢已確認但還沒有提前溝通頻道的預約
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
            """), {"current_time": now})
            
            for row in result:
                try:
                    await create_early_communication_channel(guild, row)
                except Exception as e:
                    print(f"❌ 創建提前溝通頻道失敗 {row.id}: {e}")
                    
    except Exception as e:
        print(f"❌ 檢查提前溝通頻道時發生錯誤: {e}")

async def check_voice_channel_creation(guild, now):
    """檢查需要創建語音頻道的預約（開始前5分鐘）"""
    try:
        with Session() as s:
            # 查詢開始前5分鐘且還沒有語音頻道的預約
            start_window = now + timedelta(minutes=5)
            result = s.execute(text("""
                SELECT 
                    b.id, b."customerId", b."scheduleId", b.status, b."createdAt",
                    c.name as customer_name, cu.discord as customer_discord,
                    p.name as partner_name, pu.discord as partner_discord,
                    s."startTime", s."endTime",
                    b."discordEarlyTextChannelId"
                FROM "Booking" b
                JOIN "Schedule" s ON s.id = b."scheduleId"
                JOIN "Customer" c ON c.id = b."customerId"
                JOIN "User" cu ON cu.id = c."userId"
                JOIN "Partner" p ON p.id = s."partnerId"
                JOIN "User" pu ON pu.id = p."userId"
                WHERE b.status = 'CONFIRMED'
                AND s."startTime" <= :start_window
                AND s."startTime" > :current_time
                AND b."discordVoiceChannelId" IS NULL
            """), {"start_window": start_window, "current_time": now})
            
            for row in result:
                try:
                    # 檢查是否已有提前溝通頻道 ID（預聊應已建立）
                    if not row.discordEarlyTextChannelId:
                        print(f"❌ 錯誤：預約 {row.id} 缺少提前溝通頻道 ID (discordEarlyTextChannelId)，預聊未建立頻道")
                        # 不標記為 processed，允許後續重試
                        continue
                    
                    await create_voice_and_main_text_channels(guild, row)
                    # 刪除提前溝通頻道
                    await delete_early_communication_channel(guild, row.discordEarlyTextChannelId)
                except Exception as e:
                    print(f"❌ 創建語音頻道失敗 {row.id}: {e}")
                    # 不標記為 processed，允許後續重試
                    
    except Exception as e:
        print(f"❌ 檢查語音頻道創建時發生錯誤: {e}")

async def check_extension_buttons(guild, now):
    """檢查需要顯示延長按鈕的預約（結束前10分鐘）"""
    try:
        with Session() as s:
            # 查詢結束前10分鐘且還沒有顯示延長按鈕的預約
            end_window = now + timedelta(minutes=10)
            result = s.execute(text("""
                SELECT 
                    b.id, b."customerId", b."scheduleId", b.status,
                    c.name as customer_name, cu.discord as customer_discord,
                    p.name as partner_name, pu.discord as partner_discord,
                    s."startTime", s."endTime",
                    b."discordVoiceChannelId", b."discordTextChannelId"
                FROM "Booking" b
                JOIN "Schedule" s ON s.id = b."scheduleId"
                JOIN "Customer" c ON c.id = b."customerId"
                JOIN "User" cu ON cu.id = c."userId"
                JOIN "Partner" p ON p.id = s."partnerId"
                JOIN "User" pu ON pu.id = p."userId"
                WHERE b.status = 'CONFIRMED'
                AND s."endTime" <= :end_window
                AND s."endTime" > :current_time
                AND b."discordVoiceChannelId" IS NOT NULL
                AND b."extensionButtonShown" = false
            """), {"end_window": end_window, "current_time": now})
            
            for row in result:
                try:
                    await show_extension_button(guild, row)
                except Exception as e:
                    print(f"❌ 顯示延長按鈕失敗 {row.id}: {e}")
                    
    except Exception as e:
        print(f"❌ 檢查延長按鈕時發生錯誤: {e}")

async def check_voice_channel_cleanup(guild, now):
    """檢查需要結束語音頻道的預約（時間結束）"""
    try:
        with Session() as s:
            # 查詢已結束但語音頻道還存在的預約
            result = s.execute(text("""
                SELECT 
                    b.id, b."customerId", b."scheduleId", b.status,
                    c.name as customer_name, cu.discord as customer_discord,
                    p.name as partner_name, pu.discord as partner_discord,
                    s."startTime", s."endTime",
                    b."discordVoiceChannelId", b."discordTextChannelId"
                FROM "Booking" b
                JOIN "Schedule" s ON s.id = b."scheduleId"
                JOIN "Customer" c ON c.id = b."customerId"
                JOIN "User" cu ON cu.id = c."userId"
                JOIN "Partner" p ON p.id = s."partnerId"
                JOIN "User" pu ON pu.id = p."userId"
                WHERE b.status = 'CONFIRMED'
                AND s."endTime" <= :current_time
                AND b."discordVoiceChannelId" IS NOT NULL
            """), {"current_time": now})
            
            for row in result:
                try:
                    await cleanup_voice_channel_and_show_rating(guild, row)
                except Exception as e:
                    print(f"❌ 清理語音頻道失敗 {row.id}: {e}")
                    
    except Exception as e:
        print(f"❌ 檢查語音頻道清理時發生錯誤: {e}")

async def check_text_channel_cleanup(guild, now):
    """檢查需要清理文字頻道的預約（評價完成後）"""
    try:
        with Session() as s:
            # 查詢評價完成後需要清理文字頻道的預約
            result = s.execute(text("""
                SELECT 
                    b.id, b."discordTextChannelId"
                FROM "Booking" b
                WHERE b."discordTextChannelId" IS NOT NULL
                AND b."ratingCompleted" = true
                AND b."textChannelCleaned" = false
            """), {})
            
            for row in result:
                try:
                    await cleanup_text_channel(guild, row)
                except Exception as e:
                    print(f"❌ 清理文字頻道失敗 {row.id}: {e}")
                    
    except Exception as e:
        print(f"❌ 檢查文字頻道清理時發生錯誤: {e}")

async def create_early_communication_channel(guild, booking):
    """創建提前溝通的文字頻道"""
    try:
        # 生成可愛的 emoji
        cute_item = get_cute_emoji(booking.id)
        
        # 格式化時間
        start_time = booking.startTime
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        tw_start_time = start_time.astimezone(TW_TZ)
        
        date_str = tw_start_time.strftime("%m%d")
        time_str = tw_start_time.strftime("%H%M")
        
        # 創建提前溝通頻道名稱
        channel_name = f"💬預約{date_str}-{time_str}-{cute_item}"
        
        # 創建文字頻道
        text_channel = await guild.create_text_channel(
            name=channel_name,
            category=guild.get_channel(ADMIN_CHANNEL_ID).category  # 使用管理員頻道的分類
        )
        
        # 設置頻道權限
        customer_member = find_member_by_discord_name(guild, booking.customer_discord)
        partner_member = find_member_by_discord_name(guild, booking.partner_discord)
        
        if customer_member and partner_member:
            await text_channel.set_permissions(customer_member, read_messages=True, send_messages=True)
            await text_channel.set_permissions(partner_member, read_messages=True, send_messages=True)
            await text_channel.set_permissions(guild.default_role, read_messages=False)
        
        # 發送歡迎訊息
        embed = discord.Embed(
            title="🎮 預約提前溝通頻道",
            description=f"歡迎來到預約提前溝通頻道！",
            color=0x00ff88
        )
        embed.add_field(name="預約時間", value=f"{tw_start_time.strftime('%Y/%m/%d %H:%M')}", inline=False)
        embed.add_field(name="顧客", value=f"@{booking.customer_name}", inline=True)
        embed.add_field(name="夥伴", value=f"@{booking.partner_name}", inline=True)
        embed.add_field(name="重要提醒", value="你們可以在這裡提前溝通遊戲內容、規則等。\n語音頻道將在預約開始前5分鐘自動創建。", inline=False)
        
        await text_channel.send(embed=embed)
        
        # 更新資料庫
        with Session() as s:
            s.execute(text("""
                UPDATE "Booking" 
                SET "discordEarlyTextChannelId" = :channel_id
                WHERE id = :booking_id
            """), {"channel_id": str(text_channel.id), "booking_id": booking.id})
            s.commit()
        
        print(f"✅ 已創建提前溝通頻道: {channel_name}")
        
    except Exception as e:
        print(f"❌ 創建提前溝通頻道失敗: {e}")
        raise

async def create_voice_and_main_text_channels(guild, booking):
    """創建語音頻道和正式文字頻道"""
    try:
        # 生成可愛的 emoji
        cute_item = get_cute_emoji(booking.id)
        
        # 格式化時間
        start_time = booking.startTime
        end_time = booking.endTime
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        
        tw_start_time = start_time.astimezone(TW_TZ)
        tw_end_time = end_time.astimezone(TW_TZ)
        
        date_str = tw_start_time.strftime("%m%d")
        start_time_str = tw_start_time.strftime("%H%M")
        end_time_str = tw_end_time.strftime("%H%M")
        
        # 創建語音頻道
        voice_channel_name = f"🎤{date_str} {start_time_str}-{end_time_str} {cute_item}"
        voice_channel = await guild.create_voice_channel(
            name=voice_channel_name,
            category=guild.get_channel(ADMIN_CHANNEL_ID).category
        )
        
        # 創建正式文字頻道
        text_channel_name = f"💬{date_str} {start_time_str}-{end_time_str} {cute_item}"
        text_channel = await guild.create_text_channel(
            name=text_channel_name,
            category=guild.get_channel(ADMIN_CHANNEL_ID).category
        )
        
        # 設置頻道權限
        customer_member = find_member_by_discord_name(guild, booking.customer_discord)
        partner_member = find_member_by_discord_name(guild, booking.partner_discord)
        
        if customer_member and partner_member:
            for channel in [voice_channel, text_channel]:
                await channel.set_permissions(customer_member, read_messages=True, send_messages=True, connect=True)
                await channel.set_permissions(partner_member, read_messages=True, send_messages=True, connect=True)
                await channel.set_permissions(guild.default_role, read_messages=False, connect=False)
        
        # 發送歡迎訊息到文字頻道
        embed = discord.Embed(
            title="🎮 預約頻道",
            description=f"歡迎來到預約頻道！",
            color=0x00ff88
        )
        embed.add_field(name="預約時間", value=f"{tw_start_time.strftime('%Y/%m/%d %H:%M')} - {tw_end_time.strftime('%H:%M')}", inline=False)
        embed.add_field(name="顧客", value=f"@{booking.customer_name}", inline=True)
        embed.add_field(name="夥伴", value=f"@{booking.partner_name}", inline=True)
        embed.add_field(name="語音頻道", value=f"🎤 {voice_channel_name}", inline=False)
        
        await text_channel.send(embed=embed)
        
        # 更新資料庫
        with Session() as s:
            s.execute(text("""
                UPDATE "Booking" 
                SET "discordVoiceChannelId" = :voice_channel_id,
                    "discordTextChannelId" = :text_channel_id
                WHERE id = :booking_id
            """), {
                "voice_channel_id": str(voice_channel.id),
                "text_channel_id": str(text_channel.id),
                "booking_id": booking.id
            })
            s.commit()
        
        print(f"✅ 已創建語音和文字頻道: {voice_channel_name}, {text_channel_name}")
        
    except Exception as e:
        print(f"❌ 創建語音和文字頻道失敗: {e}")
        raise

async def show_extension_button(guild, booking):
    """顯示延長按鈕"""
    try:
        # 檢查文字頻道 ID 是否存在
        if not booking.discordTextChannelId:
            print(f"❌ 錯誤：預約 {booking.id} 缺少文字頻道 ID (discordTextChannelId)，預聊未建立頻道")
            raise Exception(f"預約 {booking.id} 缺少文字頻道 ID，無法顯示延長按鈕")
        
        text_channel = guild.get_channel(int(booking.discordTextChannelId))
        if not text_channel:
            print(f"❌ 錯誤：預約 {booking.id} 的文字頻道 ID {booking.discordTextChannelId} 在 Discord 中不存在")
            raise Exception(f"預約 {booking.id} 的文字頻道不存在")
        
        # 創建延長按鈕視圖
        view = ExtensionView(booking.id, booking.startTime, booking.endTime)
        
        embed = discord.Embed(
            title="⏰ 預約即將結束",
            description="預約將在10分鐘內結束，如果需要延長遊戲時間，請點擊下方按鈕。",
            color=0xffa500
        )
        embed.add_field(name="剩餘時間", value="約10分鐘", inline=False)
        embed.add_field(name="延長選項", value="可以延長5分鐘", inline=False)
        
        await text_channel.send(embed=embed, view=view)
        
        # 標記延長按鈕已顯示
        with Session() as s:
            s.execute(text("""
                UPDATE "Booking" 
                SET "extensionButtonShown" = true
                WHERE id = :booking_id
            """), {"booking_id": booking.id})
            s.commit()
        
        print(f"✅ 已顯示延長按鈕: {booking.id}")
        
    except Exception as e:
        print(f"❌ 顯示延長按鈕失敗: {e}")
        raise

async def cleanup_voice_channel_and_show_rating(guild, booking):
    """清理語音頻道並顯示評價系統"""
    try:
        # 刪除語音頻道
        if booking.discordVoiceChannelId:
            voice_channel = guild.get_channel(int(booking.discordVoiceChannelId))
            if voice_channel:
                await voice_channel.delete()
                print(f"✅ 已刪除語音頻道: {booking.id}")
        
        # 檢查文字頻道 ID 是否存在
        if not booking.discordTextChannelId:
            print(f"❌ 錯誤：預約 {booking.id} 缺少文字頻道 ID (discordTextChannelId)，預聊未建立頻道，無法顯示評價系統")
            raise Exception(f"預約 {booking.id} 缺少文字頻道 ID，無法顯示評價系統")
        
        # 在文字頻道顯示評價系統
        text_channel = guild.get_channel(int(booking.discordTextChannelId))
        if text_channel:
            # 創建評價視圖
            view = RatingView(booking.id)
            
            embed = discord.Embed(
                title="⭐ 預約結束 - 請給予評價",
                description="預約已結束，請為您的遊戲體驗給予評價。",
                color=0x00ff88
            )
            embed.add_field(name="顧客", value=f"@{booking.customer_name}", inline=True)
            embed.add_field(name="夥伴", value=f"@{booking.partner_name}", inline=True)
            embed.add_field(name="評價說明", value="請點擊下方的星等按鈕來評價這次的遊戲體驗。", inline=False)
            
            await text_channel.send(embed=embed, view=view)
        
        # 更新資料庫狀態
        with Session() as s:
            s.execute(text("""
                UPDATE "Booking" 
                SET status = 'COMPLETED',
                    "discordVoiceChannelId" = NULL
                WHERE id = :booking_id
            """), {"booking_id": booking.id})
            s.commit()
        
        # 計算推薦收入
        try:
            calculate_referral_earnings(booking.id)
        except Exception as e:
            print(f"❌ 計算推薦收入失敗 {booking.id}: {e}")
        
        print(f"✅ 已清理語音頻道並顯示評價系統: {booking.id}")
        
    except Exception as e:
        print(f"❌ 清理語音頻道並顯示評價系統失敗: {e}")
        raise

async def delete_early_communication_channel(guild, channel_id):
    """刪除提前溝通頻道"""
    try:
        if channel_id:
            channel = guild.get_channel(int(channel_id))
            if channel:
                await channel.delete()
                print(f"✅ 已刪除提前溝通頻道: {channel_id}")
    except Exception as e:
        print(f"❌ 刪除提前溝通頻道失敗: {e}")

async def cleanup_text_channel(guild, booking):
    """清理文字頻道"""
    try:
        if booking.discordTextChannelId:
            text_channel = guild.get_channel(int(booking.discordTextChannelId))
            if text_channel:
                await text_channel.delete()
                print(f"✅ 已刪除文字頻道: {booking.id}")
        
        # 標記文字頻道已清理
        with Session() as s:
            s.execute(text("""
                UPDATE "Booking" 
                SET "textChannelCleaned" = true
                WHERE id = :booking_id
            """), {"booking_id": booking.id})
            s.commit()
        
    except Exception as e:
        print(f"❌ 清理文字頻道失敗: {e}")

def get_cute_emoji(booking_id):
    """生成可愛的 emoji"""
    cute_items = ["🎀", "🦁", "🐻", "🐱", "🐶", "🐰", "🐼", "🦄", "🍀", "⭐", "🎈", "🍭", "🌈", "🦋", "🐯", "🐸", "🦊", "🐨", "🐮", "🐷"]
    
    # 使用 booking_id 的 hash 來確保一致性
    hash_obj = hashlib.md5(booking_id.encode())
    hash_int = int(hash_obj.hexdigest(), 16)
    index = hash_int % len(cute_items)
    
    return cute_items[index]

class ExtensionView(discord.ui.View):
    def __init__(self, booking_id, start_time, end_time):
        super().__init__(timeout=None)
        self.booking_id = booking_id
        self.start_time = start_time
        self.end_time = end_time
    
    @discord.ui.button(label="延長5分鐘", style=discord.ButtonStyle.primary, emoji="⏰")
    async def extend_booking(self, interaction: discord.Interaction, button: discord.ui.Button):
        try:
            # 延長預約時間
            new_end_time = self.end_time + timedelta(minutes=5)
            
            # 更新資料庫
            with Session() as s:
                s.execute(text("""
                    UPDATE "Schedule" 
                    SET "endTime" = :new_end_time
                    WHERE id = (
                        SELECT "scheduleId" FROM "Booking" WHERE id = :booking_id
                    )
                """), {"new_end_time": new_end_time, "booking_id": self.booking_id})
                s.commit()
            
            # 更新語音頻道名稱
            guild = interaction.guild
            with Session() as s:
                result = s.execute(text("""
                    SELECT "discordVoiceChannelId", "discordTextChannelId"
                    FROM "Booking" WHERE id = :booking_id
                """), {"booking_id": self.booking_id}).fetchone()
                
                if result:
                    voice_channel_id = result[0]
                    text_channel_id = result[1]
                    
                    # 更新語音頻道名稱
                    if voice_channel_id:
                        voice_channel = guild.get_channel(int(voice_channel_id))
                        if voice_channel:
                            # 重新生成頻道名稱
                            start_time = self.start_time
                            if start_time.tzinfo is None:
                                start_time = start_time.replace(tzinfo=timezone.utc)
                            tw_start_time = start_time.astimezone(TW_TZ)
                            tw_new_end_time = new_end_time.astimezone(TW_TZ)
                            
                            date_str = tw_start_time.strftime("%m%d")
                            start_time_str = tw_start_time.strftime("%H%M")
                            end_time_str = tw_new_end_time.strftime("%H%M")
                            
                            cute_item = get_cute_emoji(self.booking_id)
                            new_voice_name = f"🎤{date_str} {start_time_str}-{end_time_str} {cute_item}"
                            
                            await voice_channel.edit(name=new_voice_name)
                    
                    # 更新文字頻道名稱
                    if text_channel_id:
                        text_channel = guild.get_channel(int(text_channel_id))
                        if text_channel:
                            new_text_name = f"💬{date_str} {start_time_str}-{end_time_str} {cute_item}"
                            await text_channel.edit(name=new_text_name)
            
            embed = discord.Embed(
                title="✅ 預約已延長",
                description="預約時間已延長5分鐘！",
                color=0x00ff88
            )
            embed.add_field(name="新結束時間", value=f"{new_end_time.astimezone(TW_TZ).strftime('%H:%M')}", inline=False)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            
        except Exception as e:
            print(f"❌ 延長預約失敗: {e}")
            await interaction.response.send_message("延長預約失敗，請聯繫管理員。", ephemeral=True)

class RatingView(discord.ui.View):
    def __init__(self, booking_id):
        super().__init__(timeout=None)
        self.booking_id = booking_id
    
    @discord.ui.button(label="⭐ 1星", style=discord.ButtonStyle.secondary, emoji="⭐")
    async def rate_1_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.submit_rating(interaction, 1)
    
    @discord.ui.button(label="⭐⭐ 2星", style=discord.ButtonStyle.secondary, emoji="⭐")
    async def rate_2_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.submit_rating(interaction, 2)
    
    @discord.ui.button(label="⭐⭐⭐ 3星", style=discord.ButtonStyle.secondary, emoji="⭐")
    async def rate_3_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.submit_rating(interaction, 3)
    
    @discord.ui.button(label="⭐⭐⭐⭐ 4星", style=discord.ButtonStyle.primary, emoji="⭐")
    async def rate_4_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.submit_rating(interaction, 4)
    
    @discord.ui.button(label="⭐⭐⭐⭐⭐ 5星", style=discord.ButtonStyle.primary, emoji="⭐")
    async def rate_5_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.submit_rating(interaction, 5)
    
    async def submit_rating(self, interaction: discord.Interaction, rating: int):
        try:
            # 獲取評價者信息
            reviewer_id = interaction.user.id
            reviewer_name = interaction.user.display_name or interaction.user.name
            
            # 保存評價到資料庫
            with Session() as s:
                # 檢查是否已經評價過
                existing_rating = s.execute(text("""
                    SELECT id FROM "Review" 
                    WHERE "bookingId" = :booking_id AND "reviewerId" = :reviewer_id
                """), {"booking_id": self.booking_id, "reviewer_id": str(reviewer_id)}).fetchone()
                
                if existing_rating:
                    await interaction.response.send_message("您已經評價過這次預約了！", ephemeral=True)
                    return
                
                # 獲取預約信息
                booking_info = s.execute(text("""
                    SELECT b."customerId", b."scheduleId", s."partnerId"
                    FROM "Booking" b
                    JOIN "Schedule" s ON s.id = b."scheduleId"
                    WHERE b.id = :booking_id
                """), {"booking_id": self.booking_id}).fetchone()
                
                if not booking_info:
                    await interaction.response.send_message("找不到預約信息！", ephemeral=True)
                    return
                
                # 確定被評價者是夥伴
                reviewee_id = booking_info[2]  # partnerId
                
                # 創建評價記錄
                s.execute(text("""
                    INSERT INTO "Review" (id, "bookingId", "reviewerId", "revieweeId", rating, comment, "createdAt")
                    VALUES (:id, :booking_id, :reviewer_id, :reviewee_id, :rating, :comment, :created_at)
                """), {
                    "id": f"rev_{int(datetime.now().timestamp())}_{reviewer_id}",
                    "booking_id": self.booking_id,
                    "reviewer_id": str(reviewer_id),
                    "reviewee_id": str(reviewee_id),
                    "rating": rating,
                    "comment": f"Discord評價 - {reviewer_name}",
                    "created_at": datetime.now()
                })
                
                # 更新預約狀態
                s.execute(text("""
                    UPDATE "Booking" 
                    SET "ratingCompleted" = true
                    WHERE id = :booking_id
                """), {"booking_id": self.booking_id})
                
                s.commit()
            
            # 發送評價確認
            embed = discord.Embed(
                title="✅ 評價已提交",
                description=f"感謝您的評價！您給予了 {rating} 星評價。",
                color=0x00ff88
            )
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
            
            # 檢查是否雙方都已評價，如果是則清理文字頻道
            with Session() as s:
                rating_count = s.execute(text("""
                    SELECT COUNT(*) FROM "Review" 
                    WHERE "bookingId" = :booking_id
                """), {"booking_id": self.booking_id}).fetchone()[0]
                
                if rating_count >= 2:  # 雙方都評價了
                    # 延遲5秒後清理文字頻道
                    import asyncio
                    await asyncio.sleep(5)
                    await cleanup_text_channel(interaction.guild, type('Booking', (), {'id': self.booking_id, 'discordTextChannelId': None})())
            
            # 發送評價到管理員頻道
            admin_channel = interaction.guild.get_channel(ADMIN_CHANNEL_ID)
            if admin_channel:
                embed = discord.Embed(
                    title="⭐ 新評價",
                    description=f"預約 {self.booking_id} 收到新評價",
                    color=0xffd700
                )
                embed.add_field(name="評價者", value=f"{reviewer_name}", inline=True)
                embed.add_field(name="星等", value=f"{'⭐' * rating}", inline=True)
                embed.add_field(name="時間", value=datetime.now().strftime("%Y/%m/%d %H:%M"), inline=True)
                
                await admin_channel.send(embed=embed)
            
        except Exception as e:
            print(f"❌ 提交評價失敗: {e}")
            await interaction.response.send_message("評價提交失敗，請聯繫管理員。", ephemeral=True)
