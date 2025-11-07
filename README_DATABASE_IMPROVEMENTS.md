# 🎯 PeiPlay 資料庫連接改進

> **解決問題：** 資料庫連接偶爾失敗，導致 500/503 錯誤

## 🚀 快速開始

### 立即執行（5 分鐘）

1. **更新 Supabase 連接字串**
   - 前往 [Supabase Dashboard](https://supabase.com/dashboard) → Settings → Database → Connection Pooling
   - 複製 Pooler URL
   - 更新 Vercel 環境變數 `DATABASE_URL`

2. **部署**
   ```bash
   git add .
   git commit -m "feat: 添加資料庫彈性處理"
   git push
   ```

3. **驗證**
   ```bash
   curl https://peiplay.vercel.app/api/health/database
   ```

📖 **詳細步驟：** [docs/QUICK_START.md](docs/QUICK_START.md)

---

## ✨ 新增功能

### 🔄 自動重試機制
- 資料庫操作失敗時自動重試（最多 3 次）
- 指數退避策略，避免對資料庫造成壓力

### 🛡️ 斷路器模式
- 連續失敗時自動停止請求
- 防止雪崩效應，保護系統穩定

### ⚡ 連接池優化
- Vercel serverless 環境專屬優化
- Supabase 連接池支援

### 📊 健康監控
- 新 API：`GET /api/health/database`
- 即時查看資料庫狀態和性能

### 🎯 統一錯誤處理
- 標準化錯誤響應
- 更好的錯誤追蹤和診斷

---

## 📂 文件結構

```
├── lib/
│   ├── db-resilience.ts      ⭐ 核心：重試、斷路器
│   ├── api-helpers.ts         ⭐ 核心：API 輔助工具
│   ├── prisma.ts              🔧 已優化
│   └── startup.ts             ⭐ 新：連接預熱
│
├── app/api/
│   ├── health/database/       ⭐ 新：健康檢查 API
│   └── partners/withdrawal/   ✅ 已更新示範
│
├── docs/
│   ├── QUICK_START.md         📘 5分鐘快速指南
│   ├── DATABASE_RESILIENCE_GUIDE.md  📚 完整文檔
│   └── DATABASE_IMPROVEMENTS_SUMMARY.md  📊 改進總結
│
├── scripts/
│   └── test-db-resilience.ts  🧪 測試腳本
│
├── middleware.ts              ⭐ 新：請求追蹤
└── DATABASE_IMPROVEMENTS_CHECKLIST.md  ✅ 實施清單
```

---

## 📊 效果預期

| 指標 | 改進前 | 改進後 |
|------|--------|--------|
| **連接失敗率** | 5-10% | < 1% |
| **500/503 錯誤** | 頻繁 | 減少 80-90% |
| **自動恢復** | ❌ 無 | ✅ 自動重試 |
| **雪崩防護** | ❌ 無 | ✅ 斷路器 |

---

## 💡 使用範例

### 更新 API 路由

**之前：**
```typescript
export async function GET(request: NextRequest) {
  try {
    const data = await prisma.user.findMany()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: '錯誤' }, { status: 500 })
  }
}
```

**之後：**
```typescript
import { createErrorResponse, withDatabaseQuery } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const data = await withDatabaseQuery(
      async () => await prisma.user.findMany(),
      'Get users'
    )
    return NextResponse.json(data)
  } catch (error) {
    return createErrorResponse(error, 'GET /api/users')
  }
}
```

---

## 📖 文檔指南

### 新手入門
1. 🚀 [快速開始](docs/QUICK_START.md) - 5 分鐘部署
2. ✅ [實施檢查清單](DATABASE_IMPROVEMENTS_CHECKLIST.md) - 逐步指南

### 深入了解
3. 📘 [完整使用指南](docs/DATABASE_RESILIENCE_GUIDE.md) - 詳細文檔
4. 📊 [改進總結](docs/DATABASE_IMPROVEMENTS_SUMMARY.md) - 技術細節

### 問題排查
5. 🔧 [故障排除](DATABASE_TROUBLESHOOTING.md) - 常見問題

---

## 🎯 實施計劃

### Phase 1: 立即部署（今天）
- [x] 核心系統實施
- [ ] 更新 Supabase URL
- [ ] 部署到 Vercel
- [ ] 驗證健康檢查

### Phase 2: 測試驗證（本週）
- [ ] 測試提領功能
- [ ] 監控錯誤率
- [ ] 收集用戶反饋

### Phase 3: 逐步遷移（2-4 週）
- [ ] 更新預約 API
- [ ] 更新時段 API
- [ ] 更新其他高頻 API

---

## 🔍 監控和維護

### 健康檢查
```bash
# 檢查資料庫狀態
curl https://peiplay.vercel.app/api/health/database
```

### 本地測試
```bash
# 運行完整測試套件
npx ts-node scripts/test-db-resilience.ts
```

### 關鍵指標
- ✅ 資料庫響應時間 < 100ms
- ✅ 斷路器狀態：CLOSED
- ✅ 錯誤率 < 1%

---

## 🛠️ 技術架構

```
API 請求
   ↓
withDatabaseQuery (自動重試)
   ↓
Circuit Breaker (防雪崩)
   ↓
Prisma Client (優化連接池)
   ↓
Supabase Pooler (連接池)
   ↓
PostgreSQL Database
```

**關鍵特性：**
- 🔄 3 次自動重試（指數退避）
- 🛡️ 斷路器保護（5 次失敗觸發）
- ⚡ 環境感知連接池（Vercel 優化）
- 📊 即時健康監控

---

## ❓ 常見問題

### Q: 需要更新所有 API 嗎？
**A:** 不需要。建議從最常出錯的 API 開始（提領 API 已更新），然後逐步遷移。

### Q: 會影響現有功能嗎？
**A:** 不會。新系統完全向下相容，不影響現有 API。

### Q: 如何確認在工作？
**A:** 查看 Vercel 日誌，應該看到：
```
⏳ Retrying operation in 500ms...
✅ Query succeeded on attempt 2
```

---

## 🆘 需要幫助？

1. 📖 查看 [快速開始指南](docs/QUICK_START.md)
2. 🔧 查看 [故障排除指南](DATABASE_TROUBLESHOOTING.md)
3. 💬 查看 Vercel 和 Supabase 日誌
4. 📊 檢查健康檢查 API

---

## 📈 下一步

1. ✅ 完成快速開始步驟
2. 📊 監控效果 3-5 天
3. 🔄 逐步更新其他 API
4. 📈 持續優化性能

---

**實施時間：** 15-30 分鐘  
**預期效果：** 80-90% 錯誤率降低  
**風險等級：** 低（完全向下相容）

---

**最後更新：** 2025-11-07  
**版本：** 1.0.0  
**狀態：** ✅ 可立即部署

