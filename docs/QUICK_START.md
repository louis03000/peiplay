# 🚀 資料庫彈性處理 - 快速開始

## 5 分鐘快速部署

### Step 1: 更新 Supabase 連接字串（必須）

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇您的專案 → Settings → Database
3. 找到 "Connection Pooling" 區塊
4. 複製 "Connection string" (Transaction mode 或 Session mode)

```
postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

5. 更新 Vercel 環境變數：
   - 前往 Vercel Dashboard → Your Project → Settings → Environment Variables
   - 更新 `DATABASE_URL` 為 Pooler URL
   - **重要：** 點擊 "Save" 後，必須重新部署應用！

### Step 2: 部署更新

```bash
# 推送代碼到 Git
git add .
git commit -m "feat: 添加資料庫彈性處理"
git push

# Vercel 會自動部署
```

或手動部署：
```bash
vercel --prod
```

### Step 3: 驗證部署

訪問健康檢查端點：

```bash
curl https://peiplay.vercel.app/api/health/database
```

期望看到：
```json
{
  "status": "healthy",
  "database": {
    "responseTime": 45,
    "responsive": true
  },
  "circuitBreaker": {
    "state": "CLOSED",
    "failureCount": 0
  }
}
```

✅ 如果狀態為 `healthy`，表示配置成功！

### Step 4: 更新其他 API 路由（推薦）

選擇最常出錯的 API 路由進行更新。

**優先級：**
1. ⭐⭐⭐ `app/api/partners/withdrawal/**` - 已更新 ✅
2. ⭐⭐⭐ `app/api/bookings/**`
3. ⭐⭐ `app/api/partners/**`
4. ⭐⭐ `app/api/schedules/**`

**範本：**

```typescript
// 1. 添加導入
import { createErrorResponse, withDatabaseQuery } from '@/lib/api-helpers'

// 2. 包裝資料庫操作
export async function GET(request: NextRequest) {
  try {
    const result = await withDatabaseQuery(async () => {
      // 您的資料庫查詢
      return await prisma.booking.findMany()
    }, 'API route name')
    
    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(error, 'GET /api/bookings')
  }
}
```

## 📊 監控和維護

### 定期檢查（建議每週）

```bash
# 健康檢查
curl https://peiplay.vercel.app/api/health/database

# 檢查 Vercel 日誌
# 前往 Vercel Dashboard → Deployments → View Function Logs
```

### 關鍵指標

- ✅ `status: "healthy"` - 資料庫正常
- ✅ `responseTime < 100ms` - 性能良好
- ✅ `circuitBreaker.state: "CLOSED"` - 無故障
- ⚠️ `responseTime > 500ms` - 需要優化
- 🚨 `status: "unhealthy"` - 需要立即處理

## 🔧 常見問題

### Q: 部署後仍然有 500 錯誤？

**檢查清單：**
1. ✅ 確認使用了 Pooler URL（包含 `.pooler.supabase.com`）
2. ✅ Vercel 環境變數已更新並重新部署
3. ✅ 健康檢查 API 返回 `healthy`
4. ✅ 查看 Vercel 日誌確認錯誤類型

### Q: 如何知道重試機制是否在工作？

查看 Vercel 日誌，應該會看到：
```
⏳ Retrying operation in 500ms...
✅ Query succeeded on attempt 2
```

### Q: 斷路器什麼時候會觸發？

連續 5 次失敗後會打開，然後：
- 60 秒內拒絕所有請求（避免雪崩）
- 60 秒後進入半開狀態（嘗試恢復）
- 成功 2 次後完全恢復

### Q: 需要更新所有 API 嗎？

**不需要立即全部更新。**

建議策略：
1. 先更新最常出錯的 API（已完成提領 API）
2. 觀察效果 1-2 天
3. 逐步更新其他 API

## 📈 效果預期

實施後 24-48 小時內應該看到：

- ✅ 500/503 錯誤減少 **80-90%**
- ✅ 用戶投訴減少
- ✅ 日誌中出現自動重試和恢復記錄

## 🎯 下一步

1. **監控效果** - 使用健康檢查 API
2. **逐步遷移** - 更新其他高頻 API
3. **性能優化** - 參考 [優化指南](./DATABASE_RESILIENCE_GUIDE.md#-性能優化建議)

## 📚 更多資源

- 📘 [完整使用指南](./DATABASE_RESILIENCE_GUIDE.md)
- 📊 [改進總結](./DATABASE_IMPROVEMENTS_SUMMARY.md)
- 🔧 [故障排除](../DATABASE_TROUBLESHOOTING.md)

## 需要幫助？

如果遇到問題：
1. 檢查健康檢查 API
2. 查看 Vercel 和 Supabase 日誌
3. 參考文檔
4. 聯繫技術支援

---

**重要提醒：**
- ⚠️ 必須使用 Supabase Pooler URL
- ⚠️ 更新環境變數後必須重新部署
- ⚠️ 定期檢查健康狀態

祝您部署順利！🎉

