# 修復評價系統問題

## 問題 1：Emoji 錯誤導致評價系統無法顯示

### 錯誤訊息
```
Invalid emoji
In components.0.components.0.emoji.name: Invalid emoji
```

### 原因
在 Discord.py 中，如果按鈕的 `label` 已經包含 emoji（如 "⭐ 1星"），就不應該再單獨設置 `emoji` 參數。或者，如果使用 `emoji` 參數，應該只使用字符串格式，且不要在 `label` 中重複包含 emoji。

### 修復方案

找到您的 `ManualRatingView` 類別（或 `RatingView`），修改按鈕定義：

**錯誤的寫法：**
```python
@discord.ui.button(label="⭐ 1星", style=discord.ButtonStyle.secondary, emoji="⭐")
```

**正確的寫法（方案 1 - 只在 label 中使用 emoji）：**
```python
@discord.ui.button(label="⭐ 1星", style=discord.ButtonStyle.secondary)
```

**正確的寫法（方案 2 - 只在 emoji 參數中使用，label 不包含 emoji）：**
```python
@discord.ui.button(label="1星", style=discord.ButtonStyle.secondary, emoji="⭐")
```

### 完整的修復代碼範例

```python
class ManualRatingView(discord.ui.View):
    def __init__(self, record_id, user1_id, user2_id):
        super().__init__(timeout=600)
        self.record_id = record_id
        self.user1_id = user1_id
        self.user2_id = user2_id
    
    # 方案 1：只在 label 中使用 emoji（推薦）
    @discord.ui.button(label="⭐ 1星", style=discord.ButtonStyle.secondary, custom_id="rating_1")
    async def rate_1_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_rating(interaction, 1)
    
    @discord.ui.button(label="⭐⭐ 2星", style=discord.ButtonStyle.secondary, custom_id="rating_2")
    async def rate_2_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_rating(interaction, 2)
    
    @discord.ui.button(label="⭐⭐⭐ 3星", style=discord.ButtonStyle.secondary, custom_id="rating_3")
    async def rate_3_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_rating(interaction, 3)
    
    @discord.ui.button(label="⭐⭐⭐⭐ 4星", style=discord.ButtonStyle.secondary, custom_id="rating_4")
    async def rate_4_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_rating(interaction, 4)
    
    @discord.ui.button(label="⭐⭐⭐⭐⭐ 5星", style=discord.ButtonStyle.secondary, custom_id="rating_5")
    async def rate_5_star(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.handle_rating(interaction, 5)
    
    # 身份選擇按鈕（如果有的話）
    @discord.ui.button(label="👤 我是顧客", style=discord.ButtonStyle.primary, custom_id="role_customer")
    async def select_customer(self, interaction: discord.Interaction, button: discord.ui.Button):
        # 處理顧客身份選擇
        pass
    
    @discord.ui.button(label="👤 我是夥伴", style=discord.ButtonStyle.primary, custom_id="role_partner")
    async def select_partner(self, interaction: discord.Interaction, button: discord.ui.Button):
        # 處理夥伴身份選擇
        pass
    
    async def handle_rating(self, interaction: discord.Interaction, rating: int):
        # 打開評價表單
        modal = RatingModal(self.record_id)
        await interaction.response.send_modal(modal)
```

## 問題 2：管理員頻道收到錯誤的配對記錄資訊

### 問題描述
1. 配對記錄的用戶ID錯誤（應該是 louis0088 和 louis0099，但顯示的是 0.08377 和 louis0088）
2. 沒有評論卻顯示"沒有收到任何評論"

### 原因分析
1. **用戶ID錯誤**：在 `countdown` 函數中，可能從錯誤的地方獲取了 `user1_id` 和 `user2_id`
2. **評價檢查錯誤**：在發送管理員訊息時，可能沒有正確檢查 `pending_ratings` 或評價數據

### 修復方案

在 `countdown` 函數中，確保從資料庫正確獲取用戶ID：

```python
async def countdown(vc_id, animal_channel_name, text_channel, vc, interaction, mentioned, record_id):
    try:
        # ... 前面的代碼 ...
        
        await vc.delete()
        print(f"🎯 語音頻道已刪除，開始評價流程: record_id={record_id}")
        
        # 從資料庫獲取正確的用戶ID
        with Session() as s:
            record = s.get(PairingRecord, record_id)
            if not record:
                print(f"❌ 找不到配對記錄: {record_id}")
                # 刪除文字頻道並返回
                if text_channel and not text_channel.deleted:
                    await text_channel.delete()
                active_voice_channels.pop(vc_id, None)
                return
            
            # 確保從資料庫獲取正確的用戶ID
            user1_id = record.user1Id
            user2_id = record.user2Id
            print(f"🔍 從資料庫獲取用戶ID: user1_id={user1_id}, user2_id={user2_id}")
        
        # 顯示評價系統
        try:
            if not text_channel or text_channel.deleted:
                print(f"⚠️ 文字頻道不存在或已刪除")
                active_voice_channels.pop(vc_id, None)
                return
            
            # 發送評價提示
            embed = discord.Embed(
                title="⭐ 語音頻道已結束 - 請進行評價",
                description="感謝您使用 PeiPlay 服務！請花一點時間為您的夥伴進行匿名評價。",
                color=0xffd700
            )
            embed.add_field(
                name="📝 評價說明",
                value="• 點擊星星選擇評分(1-5星)\n• 選擇您的身份(顧客或夥伴)\n• 留言為選填項目\n• 評價完全匿名\n• 評價結果會回報給管理員",
                inline=False
            )
            embed.set_footer(text="評價有助於我們提供更好的服務品質")
            
            await text_channel.send(embed=embed)
            
            # 創建評價 View（使用正確的用戶ID）
            view = ManualRatingView(record_id, user1_id, user2_id)
            await text_channel.send("📝 請使用下方按鈕進行評價：", view=view)
            print(f"✅ 評價系統已成功顯示")
            
        except Exception as e:
            print(f"❌ 顯示評價系統失敗: {e}")
            import traceback
            traceback.print_exc()
        
        # 等待 10 分鐘
        await asyncio.sleep(600)
        
        # 刪除文字頻道
        try:
            if text_channel and not text_channel.deleted:
                await text_channel.delete()
                print(f"🗑️ 文字頻道已刪除")
        except Exception as e:
            print(f"❌ 刪除文字頻道失敗: {e}")
        
        # 更新記錄並發送到管理員頻道
        with Session() as s:
            record = s.get(PairingRecord, record_id)
            if record:
                record.extendedTimes = active_voice_channels.get(vc_id, {}).get('extended', 0)
                record.duration += record.extendedTimes * 600
                s.commit()
                
                # 再次從資料庫獲取正確的用戶ID（確保是最新的）
                user1_id = record.user1Id
                user2_id = record.user2Id
                duration = record.duration
                extended_times = record.extendedTimes
                booking_id = record.bookingId
                
                print(f"🔍 發送管理員訊息: user1_id={user1_id}, user2_id={user2_id}")
        
        # 發送到管理員頻道
        admin = bot.get_channel(ADMIN_CHANNEL_ID)
        if admin:
            try:
                # 獲取用戶顯示名稱
                try:
                    u1 = await bot.fetch_user(int(user1_id))
                    user1_display = u1.mention
                except:
                    user1_display = f"<@{user1_id}>"
                
                try:
                    u2 = await bot.fetch_user(int(user2_id))
                    user2_display = u2.mention
                except:
                    user2_display = f"<@{user2_id}>"
                
                header = f"📋 配對紀錄：{user1_display} × {user2_display} | {duration//60} 分鐘 | 延長 {extended_times} 次"
                if booking_id:
                    header += f" | 預約ID: {booking_id}"
                
                # 檢查是否有評價（從 pending_ratings 或資料庫）
                has_ratings = False
                feedback = "\n⭐ 評價回饋："
                
                # 檢查 pending_ratings
                if record_id in pending_ratings and len(pending_ratings[record_id]) > 0:
                    has_ratings = True
                    for r in pending_ratings[record_id]:
                        try:
                            from_user = await bot.fetch_user(int(r['user1']))
                            from_user_display = from_user.mention
                        except:
                            from_user_display = f"<@{r['user1']}>"
                        
                        try:
                            to_user = await bot.fetch_user(int(r['user2']))
                            to_user_display = to_user.mention
                        except:
                            to_user_display = f"<@{r['user2']}>"
                        
                        feedback += f"\n- 「{from_user_display} → {to_user_display}」：{r['rating']} ⭐"
                        if r.get('comment'):
                            feedback += f"\n  💬 {r['comment']}"
                    
                    del pending_ratings[record_id]
                
                # 也檢查資料庫中是否有評價
                with Session() as s:
                    db_record = s.get(PairingRecord, record_id)
                    if db_record and db_record.rating:
                        if not has_ratings:
                            has_ratings = True
                            feedback += f"\n- 評分：{db_record.rating} ⭐"
                            if db_record.comment:
                                feedback += f"\n  💬 {db_record.comment}"
                
                if has_ratings:
                    await admin.send(f"{header}{feedback}")
                else:
                    await admin.send(f"{header}\n⭐ 沒有收到任何評價。")
                    
            except Exception as e:
                print(f"❌ 推送管理區評價失敗：{e}")
                import traceback
                traceback.print_exc()
        
        active_voice_channels.pop(vc_id, None)
        
    except Exception as e:
        print(f"❌ 倒數錯誤: {e}")
        import traceback
        traceback.print_exc()
```

## 檢查清單

在應用修復後，請確認：

1. ✅ 按鈕定義中沒有同時使用 `label` 中的 emoji 和 `emoji` 參數
2. ✅ 從資料庫正確獲取 `user1_id` 和 `user2_id`
3. ✅ 在發送管理員訊息前，正確檢查是否有評價數據
4. ✅ 使用正確的 `record_id` 來查找配對記錄








