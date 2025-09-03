import discord
from discord.ext import commands
import aiohttp
import json
import os
from typing import Optional

class GiftCommands(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.api_base_url = os.getenv('API_BASE_URL', 'http://localhost:3000')
        
    @commands.command(name='gift')
    async def send_gift(self, ctx, member: discord.Member, *, gift_name: str):
        """贈送禮物給指定成員"""
        try:
            # 檢查是否在預約頻道中
            if not self.is_booking_channel(ctx.channel):
                await ctx.send("❌ 只能在預約頻道中贈送禮物！")
                return
            
            # 檢查贈送者和接收者
            sender_id = str(ctx.author.id)
            receiver_id = str(member.id)
            
            # 檢查是否為有效的預約關係
            if not await self.is_valid_booking_relationship(sender_id, receiver_id, ctx.channel.id):
                await ctx.send("❌ 只能贈送禮物給預約中的夥伴/顧客！")
                return
            
            # 發送禮物請求到後端 API
            response = await self.send_gift_request(sender_id, receiver_id, gift_name, ctx.channel.id)
            
            if response.get('success'):
                gift_info = response['gift']
                await ctx.send(
                    f"🎉 **{ctx.author.display_name}** 送了一個 {gift_info['emoji']} **{gift_info['name']}** 給 **{member.display_name}**！\n"
                    f"🪙 消耗金幣：{gift_info['coins']} 金幣\n"
                    f"💰 夥伴收益：{gift_info['partnerEarned']} 金幣"
                )
            else:
                await ctx.send(f"❌ {response.get('error', '贈送禮物失敗')}")
                
        except Exception as e:
            await ctx.send(f"❌ 贈送禮物失敗：{str(e)}")

    @commands.command(name='coins')
    async def check_coins(self, ctx):
        """查看自己的金幣餘額"""
        try:
            user_id = str(ctx.author.id)
            balance = await self.get_user_coins(user_id)
            
            embed = discord.Embed(
                title="🪙 金幣餘額",
                description=f"**{ctx.author.display_name}** 的金幣資訊",
                color=0xffd700
            )
            embed.add_field(name="當前餘額", value=f"{balance['current']} 金幣", inline=True)
            embed.add_field(name="總儲值", value=f"{balance['total']} 金幣", inline=True)
            embed.add_field(name="可用餘額", value=f"{balance['available']} 金幣", inline=True)
            
            await ctx.send(embed=embed)
            
        except Exception as e:
            await ctx.send(f"❌ 查詢金幣餘額失敗：{str(e)}")

    @commands.command(name='gifts')
    async def list_gifts(self, ctx):
        """列出可用的禮物"""
        try:
            gifts = await self.get_available_gifts()
            
            embed = discord.Embed(
                title="🎁 可用禮物",
                description="選擇禮物贈送給夥伴或顧客",
                color=0xff69b4
            )
            
            for gift in gifts:
                embed.add_field(
                    name=f"{gift['emoji']} {gift['name']}",
                    value=f"🪙 {gift['coinCost']} 金幣\n💰 夥伴收益：{gift['partnerEarned']} 金幣",
                    inline=True
                )
            
            embed.set_footer(text="使用 !gift @用戶 禮物名稱 來贈送禮物")
            await ctx.send(embed=embed)
            
        except Exception as e:
            await ctx.send(f"❌ 查詢禮物列表失敗：{str(e)}")

    def is_booking_channel(self, channel):
        """檢查是否為預約頻道"""
        # 檢查頻道名稱是否包含日期和時間格式
        import re
        pattern = r'\d{2}/\d{2}\s+\d{2}:\d{2}-\d{2}:\d{2}'
        return re.search(pattern, channel.name) is not None

    async def is_valid_booking_relationship(self, sender_id: str, receiver_id: str, channel_id: str) -> bool:
        """檢查是否為有效的預約關係"""
        try:
            # 這裡可以添加檢查邏輯，確保發送者和接收者在同一個預約中
            # 暫時返回 True，實際應該檢查資料庫
            return True
        except Exception as e:
            print(f"檢查預約關係失敗: {e}")
            return False

    async def send_gift_request(self, sender_id: str, receiver_id: str, gift_name: str, channel_id: str):
        """發送禮物請求到後端 API"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_base_url}/api/gifts/send",
                    json={
                        'senderId': sender_id,
                        'receiverId': receiver_id,
                        'giftName': gift_name,
                        'channelId': channel_id
                    }
                ) as response:
                    return await response.json()
        except Exception as e:
            print(f"發送禮物請求失敗: {e}")
            return {'success': False, 'error': '網路請求失敗'}

    async def get_user_coins(self, user_id: str):
        """獲取用戶金幣資訊"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.api_base_url}/api/user/coins") as response:
                    data = await response.json()
                    if data.get('success'):
                        return {
                            'current': data.get('coinBalance', 0),
                            'total': data.get('totalRecharged', 0),
                            'available': data.get('coinBalance', 0)
                        }
                    else:
                        return {'current': 0, 'total': 0, 'available': 0}
        except Exception as e:
            print(f"獲取用戶金幣失敗: {e}")
            return {'current': 0, 'total': 0, 'available': 0}

    async def get_available_gifts(self):
        """獲取可用禮物列表"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.api_base_url}/api/gifts/list") as response:
                    data = await response.json()
                    if data.get('success'):
                        gifts = data.get('gifts', [])
                        # 計算夥伴收益
                        for gift in gifts:
                            gift['partnerEarned'] = int(gift['coinCost'] * float(gift['partnerShare']))
                        return gifts
                    else:
                        return []
        except Exception as e:
            print(f"獲取禮物列表失敗: {e}")
            return []

async def setup(bot):
    await bot.add_cog(GiftCommands(bot))
