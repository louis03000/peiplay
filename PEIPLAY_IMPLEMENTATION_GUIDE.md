# PeiPlay - 遊戲陪玩預約平台製作技術指南

> **PeiPlay** 是一個現代化的遊戲陪玩預約平台。本文檔詳細說明如何製作整個 PeiPlay 平台，包括使用的技術、架構設計、實現方法和部署策略。

---

## 📋 目錄

1. [專案概述與技術選型](#專案概述與技術選型)
2. [前端技術實現方式](#前端技術實現方式)
3. [後端架構設計與實現](#後端架構設計與實現)
4. [資料庫設計與優化策略](#資料庫設計與優化策略)
5. [使用者體驗邏輯的技術方案](#使用者體驗邏輯的技術方案)
6. [安全防護機制實現](#安全防護機制實現)
7. [創新功能的實現方式](#創新功能的實現方式)
8. [部署與運維策略](#部署與運維策略)

---

## 專案概述與技術選型

### 核心技術棧

**前端技術：**
- **Next.js 14**：使用 App Router 架構，支援 Server Components 和 Client Components 分離
- **React 18**：使用 Hooks (useState, useMemo, useCallback) 進行狀態管理
- **TypeScript**：提供類型安全，減少運行時錯誤
- **Tailwind CSS**：使用 Utility-first CSS 框架，快速建立響應式設計
- **Headless UI**：無樣式 UI 元件庫，提供無障礙設計支援

**後端技術：**
- **Next.js API Routes**：使用 Next.js 內建的 API 路由系統
- **Prisma ORM**：類型安全的資料庫查詢，自動生成 TypeScript 類型
- **NextAuth.js**：JWT-based 身份驗證系統
- **Redis (Upstash)**：用於速率限制、快取和會話管理

**資料庫：**
- **PostgreSQL (Supabase)**：關聯式資料庫，支援複雜查詢和交易
- **Prisma Migrate**：資料庫版本控制和遷移工具

**部署與運維：**
- **Vercel**：前端和 API 部署平台
- **Supabase**：PostgreSQL 資料庫託管
- **Upstash Redis**：Redis 雲端服務
- **GitHub Actions**：CI/CD 自動化部署

### 專案架構設計

**目錄結構：**
```
PeiPlay/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由（後端邏輯）
│   ├── (pages)/           # 前端頁面
│   └── components/        # React 元件
├── lib/                   # 共用函式庫
│   ├── auth.ts           # 身份驗證配置
│   ├── prisma.ts         # 資料庫客戶端
│   ├── security.ts       # 安全相關函數
│   └── redis-cache.ts    # Redis 快取
├── services/              # 業務邏輯層
│   ├── booking/          # 預約服務
│   └── schedule/         # 時段服務
├── prisma/               # 資料庫 Schema
│   └── schema.prisma     # Prisma Schema 定義
└── public/               # 靜態資源
```

**分層架構：**
1. **表現層 (Presentation Layer)**：Next.js 頁面和元件
2. **API 層 (API Layer)**：Next.js API Routes
3. **服務層 (Service Layer)**：業務邏輯處理
4. **資料層 (Data Layer)**：Prisma ORM + PostgreSQL

---

## 前端技術實現方式

### 1. Next.js App Router 架構

**實現方式：**
- 使用 Next.js 14 的 App Router，採用檔案系統路由
- 每個資料夾代表一個路由，`page.tsx` 是頁面元件
- `layout.tsx` 提供共享佈局，`loading.tsx` 提供載入狀態
- `error.tsx` 提供錯誤處理

**Server Components vs Client Components：**
- **Server Components**：預設所有元件都是 Server Components，在伺服器端渲染，減少客戶端 JavaScript 大小
- **Client Components**：使用 `'use client'` 指令標記，用於需要互動性的元件（表單、狀態管理、事件處理）

**實現範例：**
```typescript
// app/page.tsx (Server Component)
export default function HomePage() {
  // 在伺服器端執行，可以直接查詢資料庫
  const announcements = await fetchAnnouncements();
  return <HomeContent announcements={announcements} />;
}

// app/components/BookingForm.tsx (Client Component)
'use client';
export default function BookingForm() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  // 需要客戶端互動，使用 Client Component
}
```

### 2. Tailwind CSS 樣式系統

**實現方式：**
- 使用 Tailwind CSS 的 Utility-first 方法
- 透過 `tailwind.config.js` 配置自定義主題色彩
- 使用響應式斷點 (`sm:`, `md:`, `lg:`, `xl:`) 實現 RWD

**配色方案設計：**
- 主色調：漸層藍紫色 (`from-blue-500 to-purple-600`)
- 強調色：`#6C63FF` (紫色)
- 背景色：白色和灰色系
- 文字色：深灰色 (`text-gray-900`) 和淺灰色 (`text-gray-600`)

**響應式設計策略：**
- 手機優先 (Mobile-first)：預設樣式針對手機設計
- 使用 Tailwind 的響應式前綴：`sm:` (640px+), `md:` (768px+), `lg:` (1024px+)
- 彈性佈局：使用 `flex` 和 `grid` 實現自適應佈局

### 3. 狀態管理策略

**實現方式：**
- 使用 React Hooks 進行本地狀態管理
- `useState`：管理簡單狀態（表單輸入、UI 狀態）
- `useMemo`：快取計算結果（時段狀態映射、篩選結果）
- `useCallback`：快取函數引用（事件處理函數）

**狀態管理範例：**
```typescript
// 時段管理頁面的狀態設計
const [schedules, setSchedules] = useState<Schedule[]>([]); // 已儲存的時段
const [pendingAdd, setPendingAdd] = useState<{[key: string]: boolean}>({}); // 待新增的時段
const [pendingDelete, setPendingDelete] = useState<{[key: string]: boolean}>({}); // 待刪除的時段
const [isSaving, setIsSaving] = useState(false); // 儲存中鎖定狀態

// 使用 useMemo 快取計算結果
const cellStatesMap = useMemo(() => {
  // 計算所有格子的狀態
  // 只在 schedules, pendingAdd, pendingDelete 改變時重新計算
}, [schedules, pendingAdd, pendingDelete]);
```

### 4. 表單驗證與即時回饋

**實現方式：**
- 前端即時驗證：使用 JavaScript 正則表達式檢查格式
- 後端二次驗證：不信任前端，在 API 端點再次驗證
- 錯誤訊息顯示：使用 Tailwind CSS 樣式顯示錯誤提示

**驗證邏輯：**
- Email 驗證：使用正則表達式 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- 密碼強度：檢查長度、大小寫字母、數字、特殊字符
- 即時回饋：在 `onChange` 事件中即時檢查並顯示錯誤

### 5. 多語言支援 (i18n)

**實現方式：**
- 使用 `next-intl` 套件實現國際化
- 語言檔案存放在 `messages/` 目錄
- 使用 `useTranslations` Hook 在元件中取得翻譯文字

**語言切換機制：**
- 使用 `LanguageSwitcher` 元件提供語言選擇
- 語言偏好儲存在 LocalStorage
- 使用 Next.js Middleware 根據語言偏好重定向

### 6. 無障礙設計 (A11y)

**實現方式：**
- 使用語義化 HTML 標籤 (`<nav>`, `<main>`, `<section>`)
- 添加 ARIA 標籤 (`aria-label`, `aria-describedby`)
- 鍵盤導航支援：使用 Tab 鍵可以導航所有互動元素
- Headless UI 元件自動提供無障礙支援

---

## 後端架構設計與實現

### 1. API 路由設計

**實現方式：**
- 使用 Next.js API Routes，每個 API 端點是一個 `route.ts` 檔案
- RESTful API 設計：GET (讀取), POST (建立), PUT (更新), DELETE (刪除)
- 統一的回應格式：`{ success: boolean, data?: any, error?: string }`

**API 路由結構：**
```
app/api/
├── auth/              # 身份驗證相關
│   ├── register/     # 註冊 API
│   └── login/        # 登入 API
├── bookings/         # 預約相關
│   ├── route.ts      # 建立/查詢預約
│   └── [id]/         # 單一預約操作
├── partner/          # 夥伴相關
│   └── schedule/     # 時段管理
└── admin/            # 管理員功能
```

### 2. 服務層架構

**實現方式：**
- 將業務邏輯從 API 路由中分離到 `services/` 目錄
- API 路由只負責請求處理、驗證和回應
- 服務層負責業務邏輯、資料驗證、交易處理

**服務層設計原則：**
1. 所有資料庫操作都在服務層
2. Transaction 完全隔離在服務函數內
3. 服務層不依賴其他服務層（避免循環依賴）
4. 返回統一的結果類型 (`ServiceResult<T>`)

**範例結構：**
```typescript
// services/booking/booking.service.ts
export async function createBooking(input: CreateBookingInput) {
  // 在 transaction 內執行所有操作
  return await prisma.$transaction(async (tx) => {
    // 1. 驗證輸入
    // 2. 檢查衝突
    // 3. 建立預約
    // 4. 返回結果
  });
}

// app/api/bookings/route.ts
export async function POST(request: Request) {
  const input = await request.json();
  const result = await createBooking(input);
  return NextResponse.json(result);
}
```

### 3. 身份驗證系統

**實現方式：**
- 使用 NextAuth.js 作為身份驗證框架
- 支援 Credentials Provider（帳號密碼登入）和 Line Provider（第三方登入）
- JWT Token 策略：使用 JWT 儲存會話資訊，減少資料庫查詢

**身份驗證流程：**
1. 用戶提交登入資訊
2. NextAuth.js 的 `authorize` 函數驗證帳號密碼
3. 驗證成功後，`jwt` callback 建立 JWT Token
4. `session` callback 將 Token 資訊加入 Session
5. 後續請求透過 Session 取得用戶資訊

**優化策略：**
- 使用 Redis 快取用戶角色資訊，避免每次請求查詢資料庫
- JWT Token 中儲存常用資訊（role, partnerId），減少資料庫查詢

### 4. 速率限制系統

**實現方式：**
- 使用 Redis 實作分散式速率限制
- 支援 IP-based 和 UserID-based 雙重限制
- 使用 Upstash Redis 作為雲端 Redis 服務

**速率限制邏輯：**
1. 從請求中取得 IP 地址和 UserID
2. 建立 Redis Key：`rate_limit:ip:{ip}` 或 `rate_limit:user:{userId}`
3. 使用 Redis `INCR` 增加計數
4. 設置 TTL（Time To Live）自動過期
5. 檢查計數是否超過限制，超過則返回 429 錯誤

**配置預設：**
- 登入/註冊：5 次 / 5 分鐘（IP + UserID）
- 一般 API：100 次 / 15 分鐘（IP）
- 敏感操作：10 次 / 15 分鐘（IP + UserID）
- 註冊：3 次 / 1 小時（IP）

### 5. 錯誤處理機制

**實現方式：**
- 統一的錯誤處理函數 `createErrorResponse`
- 使用 TypeScript 的 Discriminated Union 類型定義錯誤結果
- 記錄錯誤日誌到資料庫 (`SecurityLog`, `LogEntry`)

**錯誤處理流程：**
1. 捕獲所有錯誤（try-catch）
2. 判斷錯誤類型（Prisma 錯誤、驗證錯誤、業務邏輯錯誤）
3. 轉換為使用者友善的錯誤訊息
4. 記錄到日誌系統
5. 返回適當的 HTTP 狀態碼和錯誤訊息

---

## 資料庫設計與優化策略

### 1. Prisma ORM 使用

**實現方式：**
- 使用 Prisma Schema 定義資料模型
- 使用 Prisma Client 進行類型安全的資料庫查詢
- 使用 Prisma Migrate 進行資料庫版本控制

**Schema 設計原則：**
- 使用關聯 (`@relation`) 定義表之間的關係
- 使用索引 (`@@index`) 優化查詢效能
- 使用 Enum 類型定義狀態值
- 使用 `@default()` 設定預設值

**範例：**
```prisma
model Booking {
  id         String   @id @default(cuid())
  customerId String
  partnerId  String
  scheduleId String  @unique
  status     BookingStatus @default(PENDING)
  
  customer   Customer @relation(fields: [customerId], references: [id])
  partner    Partner  @relation(fields: [partnerId], references: [id])
  schedule   Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  
  @@index([customerId, createdAt])
  @@index([partnerId, status, createdAt])
}
```

### 2. 索引優化策略

**實現方式：**
- 為常用查詢欄位建立索引
- 使用複合索引優化多欄位查詢
- 使用部分索引 (Partial Index) 過濾特定條件

**索引設計範例：**
```sql
-- 複合索引：優化時段查詢
CREATE INDEX "Schedule_partnerId_date_startTime_idx"
ON "Schedule"("partnerId", "date", "startTime");

-- 部分索引：只索引非拒絕的訊息（大幅提升查詢速度）
CREATE INDEX "ChatMessage_roomId_createdAt_not_rejected_idx"
ON "ChatMessage"("roomId", "createdAt" DESC)
WHERE "moderationStatus" != 'REJECTED';
```

### 3. N+1 問題解決

**實現方式：**
- 使用批量查詢取代循環查詢
- 使用 `select` 只查詢必要欄位
- 使用 `include` 預先載入關聯資料

**優化範例：**
```typescript
// ❌ 錯誤：N+1 查詢
const partners = await prisma.partner.findMany();
for (const partner of partners) {
  const reviews = await prisma.review.findMany({
    where: { revieweeId: partner.userId },
  });
}

// ✅ 正確：批量查詢
const partners = await prisma.partner.findMany({
  select: { id: true, userId: true },
});
const userIds = partners.map(p => p.userId);
const avgRatings = await prisma.review.groupBy({
  by: ['revieweeId'],
  where: { revieweeId: { in: userIds } },
  _avg: { rating: true },
});
```

### 4. 交易處理

**實現方式：**
- 使用 Prisma `$transaction` 確保原子性操作
- 設定交易超時時間（`maxWait`, `timeout`）
- 在交易內執行所有相關操作

**交易範例：**
```typescript
await prisma.$transaction(async (tx) => {
  // 1. 檢查衝突
  const conflict = await checkTimeConflict(tx);
  if (conflict) throw new Error('時間衝突');
  
  // 2. 建立時段
  const schedule = await tx.schedule.create({ data: scheduleData });
  
  // 3. 建立預約
  const booking = await tx.booking.create({ 
    data: { ...bookingData, scheduleId: schedule.id } 
  });
  
  return { schedule, booking };
}, {
  maxWait: 10000,  // 等待交易開始的最大時間（10秒）
  timeout: 20000,  // 交易執行的最大時間（20秒）
});
```

---

## 使用者體驗邏輯的技術方案

### 1. 搜尋與篩選功能

**實現方式：**
- 前端使用 React State 管理搜尋條件
- 後端使用 Prisma 的 `where` 條件進行篩選
- 使用 `contains` 和 `mode: 'insensitive'` 實現不區分大小寫搜尋

**搜尋邏輯：**
```typescript
// 前端：管理搜尋狀態
const [search, setSearch] = useState('');
const [selectedGame, setSelectedGame] = useState('');

// 後端：建立查詢條件
const where: Prisma.PartnerWhereInput = {
  status: 'APPROVED',
  OR: [
    { name: { contains: search, mode: 'insensitive' } },
    { games: { has: search } },
  ],
  ...(selectedGame ? { games: { has: selectedGame } } : {}),
};
```

### 2. 分頁功能

**實現方式：**
- 使用 Prisma 的 `skip` 和 `take` 實現分頁
- 前端傳遞 `page` 和 `limit` 參數
- 後端計算 `skip = (page - 1) * limit`

**分頁邏輯：**
```typescript
const page = parseInt(searchParams.get('page') || '1');
const limit = parseInt(searchParams.get('limit') || '10');
const skip = (page - 1) * limit;

const [data, total] = await Promise.all([
  prisma.partner.findMany({ skip, take: limit }),
  prisma.partner.count(),
]);

return {
  data,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  },
};
```

### 3. 排序功能

**實現方式：**
- 使用 Prisma 的 `orderBy` 進行排序
- 前端傳遞 `sortBy` 和 `sortOrder` 參數
- 支援多欄位排序

**排序邏輯：**
```typescript
const sortBy = searchParams.get('sortBy') || 'createdAt';
const sortOrder = searchParams.get('sortOrder') || 'desc';

const partners = await prisma.partner.findMany({
  orderBy: { [sortBy]: sortOrder },
});
```

### 4. 批次操作

**實現方式：**
- 前端使用多選框 (`checkbox`) 選擇多個項目
- 後端使用 Prisma 的 `deleteMany` 或 `updateMany` 進行批次操作
- 在交易內執行所有操作，確保原子性

### 5. 書籤/我的最愛功能

**實現方式：**
- 建立 `Favorite` 資料表儲存收藏關係
- 前端使用按鈕切換收藏狀態
- 後端使用 `upsert` 操作（存在則刪除，不存在則新增）

### 6. 歷史紀錄

**實現方式：**
- 使用資料庫的 `createdAt` 和 `updatedAt` 欄位記錄時間
- 使用 `LogEntry` 資料表記錄重要操作
- 前端顯示時間戳記，使用 `dayjs` 格式化顯示

---

## 安全防護機制實現

### 1. SQL Injection 防護

**實現方式：**
- 使用 Prisma ORM，自動使用參數化查詢
- 避免使用 `$queryRawUnsafe`，改用 `$queryRaw` 或 Prisma 查詢
- 所有用戶輸入都經過 Prisma 的類型檢查

### 2. XSS 防護

**實現方式：**
- 使用 `sanitizeInput` 函數移除 HTML 標籤
- 使用 `escapeHtml` 函數編碼特殊字符
- 設定 Content Security Policy (CSP) 限制資源載入

**CSP 設定：**
```typescript
// next.config.js
headers: [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // ...
    ].join('; '),
  },
]
```

### 3. CSRF 防護

**實現方式：**
- 使用 Double Submit Cookie 模式
- 登入成功後在 Cookie 中設置 CSRF Token
- 所有狀態變更請求（POST, PUT, DELETE）都需要在 Header 中發送 CSRF Token
- 後端驗證 Cookie 和 Header 中的 Token 是否匹配

### 4. 密碼安全

**實現方式：**
- 使用 bcrypt (12 rounds) 或 Argon2 進行密碼雜湊
- 密碼強度驗證：最少 8 個字符，必須包含大小寫字母、數字、特殊字符
- 密碼歷史記錄：防止重用最近 5 個密碼
- 密碼年齡檢查：90 天後強制更新密碼

### 5. 安全標頭設定

**實現方式：**
- 在 `next.config.js` 中設定安全標頭
- 包括：HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- 使用 Vercel 的 Edge Middleware 在請求層級設定標頭

---

## 創新功能的實現方式

### 1. 即時預約系統

**實現方式：**
- 前端顯示「現在有空」的夥伴列表
- 後端查詢 `isAvailableNow = true` 的夥伴
- 使用資料庫交易確保時段不會被重複預約
- 自動建立時段和預約記錄

**技術要點：**
- 使用 Prisma Transaction 確保原子性
- 檢查時間衝突後立即建立預約
- 設定預約狀態為 `PAID_WAITING_PARTNER_CONFIRMATION`

### 2. 群組預約系統

**實現方式：**
- 建立 `GroupBooking` 資料表儲存群組資訊
- 建立 `GroupBookingParticipant` 資料表儲存參與者
- 前端提供群組預約表單，設定最大參與人數
- 後端使用交易建立群組預約和所有參與者的預約記錄

**技術要點：**
- 使用 `maxParticipants` 限制參與人數
- 使用 `currentParticipants` 追蹤當前參與人數
- 建立群組聊天室 (`ChatRoom`) 供參與者交流

### 3. 多人陪玩系統

**實現方式：**
- 建立 `MultiPlayerBooking` 資料表儲存多人陪玩資訊
- 前端允許選擇多個夥伴和對應的時段
- 後端批量建立多個預約記錄，都關聯到同一個 `MultiPlayerBooking`
- 統一管理所有預約的狀態和價格

**技術要點：**
- 使用 `Promise.all` 並行檢查所有時段的衝突
- 在單一交易內建立所有預約記錄
- 計算總價格並儲存在 `MultiPlayerBooking` 中

### 4. Discord 整合

**實現方式：**
- 使用 Discord.py 建立 Discord Bot
- 使用 Discord API 建立語音頻道和文字頻道
- 將 Discord Channel ID 儲存在預約記錄中
- 使用 Webhook 發送通知到 Discord

**技術架構：**
- Discord Bot 使用 Python 開發，獨立運行
- 透過 REST API 與 PeiPlay 後端通訊
- 使用 Discord Gateway 監聽事件（語音頻道加入/離開）

### 5. 即時通訊系統

**實現方式：**
- 建立 `ChatRoom` 和 `ChatMessage` 資料表
- 使用 Server-Sent Events (SSE) 或 WebSocket 實現即時更新
- 前端使用 `setInterval` 輪詢新訊息（簡單實現）
- 後端提供訊息 API，支援分頁查詢

**技術要點：**
- 使用複合索引優化訊息查詢效能
- 使用部分索引過濾被拒絕的訊息
- 實作訊息審核機制 (`moderationStatus`)

### 6. 通知系統

**實現方式：**
- 建立 `PersonalNotification` 資料表儲存個人通知
- 建立 `Announcement` 資料表儲存系統公告
- 使用批量查詢優化通知載入效能
- 前端使用 `useEffect` 定期輪詢新通知

**技術要點：**
- 使用 Redis 快取通知數量，減少資料庫查詢
- 實作通知過期機制 (`expiresAt`)
- 支援通知優先級 (`priority`) 和重要性標記 (`isImportant`)

### 7. 推薦系統

**實現方式：**
- 建立 `ReferralEarning` 資料表記錄推薦獎金
- 夥伴申請時可以輸入推薦碼 (`inviteCode`)
- 當被推薦的夥伴完成首次預約時，發放推薦獎金
- 使用 Prisma Transaction 確保獎金發放的原子性

---

## 部署與運維策略

### 1. Vercel 部署

**部署方式：**
- 連接 GitHub 倉庫，自動部署
- 每次 `git push` 觸發自動部署
- 支援 Preview Deployments（每個 PR 都有獨立的預覽環境）

**環境變數設定：**
- 在 Vercel Dashboard 設定環境變數
- 支援 Production、Preview、Development 三種環境
- 使用 Vercel 的環境變數加密功能保護敏感資訊

**部署流程：**
1. 推送程式碼到 GitHub
2. Vercel 自動偵測變更
3. 執行 `npm run build` 構建專案
4. 部署到 Vercel Edge Network
5. 自動分配 HTTPS 憑證

### 2. 資料庫部署 (Supabase)

**部署方式：**
- 使用 Supabase 託管 PostgreSQL 資料庫
- 使用 Prisma Migrate 進行資料庫遷移
- 在 Supabase SQL Editor 執行遷移腳本

**遷移流程：**
1. 本地開發：`npx prisma migrate dev`
2. 生成遷移檔案：`prisma/migrations/`
3. 在 Supabase SQL Editor 執行遷移 SQL
4. 或使用 `prisma db push` 直接推送 Schema

### 3. Redis 部署 (Upstash)

**部署方式：**
- 使用 Upstash Redis 雲端服務
- 在 Upstash Console 建立 Redis 資料庫
- 取得連接字串並設定為環境變數

**設定步驟：**
1. 前往 [Upstash Console](https://console.upstash.com/)
2. 建立 Redis 資料庫
3. 選擇區域（建議與 Vercel 相同區域）
4. 複製 Redis URL
5. 在 Vercel 設定 `REDIS_URL` 環境變數

### 4. CI/CD 自動化

**實現方式：**
- 使用 GitHub Actions 實現自動化部署
- 設定 Workflow 在 push 到 main 分支時自動部署
- 執行測試和建構檢查

**GitHub Actions Workflow：**
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npm run test
```

### 5. 監控與日誌

**實現方式：**
- 使用 Vercel Analytics 監控網站效能
- 使用 Vercel Logs 查看部署和運行日誌
- 在應用中記錄重要操作到資料庫 (`LogEntry`, `SecurityLog`)

**日誌記錄策略：**
- 安全事件記錄到 `SecurityLog`（登入失敗、CSRF 攻擊等）
- 業務操作記錄到 `LogEntry`（預約建立、狀態變更等）
- 使用 Prisma 的 `createdAt` 自動記錄時間戳記

### 6. 效能優化

**前端優化：**
- 使用 Next.js Image Optimization 優化圖片
- 使用 `next/dynamic` 實現程式碼分割
- 使用 `useMemo` 和 `useCallback` 減少重新渲染
- 設定適當的快取策略

**後端優化：**
- 使用 Redis 快取常用查詢結果
- 使用 Prisma 的 `select` 只查詢必要欄位
- 使用批量查詢避免 N+1 問題
- 使用資料庫索引優化查詢效能

**快取策略：**
- 靜態資源：長期快取（1 年）
- API 回應：短期快取（10-60 秒）
- 資料庫查詢：使用 Redis 快取（5-30 分鐘）

### 7. 備份與還原

**實現方式：**
- Supabase 自動備份資料庫（每日備份）
- 使用 Prisma Migrate 記錄所有 Schema 變更
- 重要資料使用 `createdAt` 和 `updatedAt` 追蹤變更歷史

**還原流程：**
1. 在 Supabase Dashboard 選擇備份時間點
2. 執行還原操作
3. 驗證資料完整性
4. 重新部署應用（如果需要）

### 8. 環境分離

**實現方式：**
- 使用不同的環境變數區分開發、測試、生產環境
- Vercel 支援多環境部署（Production、Preview、Development）
- 使用不同的資料庫實例（開發用本地，生產用 Supabase）

**環境變數管理：**
- 開發環境：使用 `.env.local` 檔案
- 生產環境：在 Vercel Dashboard 設定
- 使用 `.env.example` 作為範本，不提交實際的 `.env` 檔案

---

## 開發工具與工作流程

### 1. 版本控制

**實現方式：**
- 使用 Git 進行版本控制
- 使用 GitHub 作為遠端倉庫
- 使用有意義的 Commit 訊息
- 使用分支策略（main, develop, feature/*）

### 2. 程式碼品質

**實現方式：**
- 使用 TypeScript 提供類型安全
- 使用 ESLint 檢查程式碼風格
- 使用 Prettier 自動格式化程式碼
- 在 `next.config.js` 中設定 `eslint.ignoreDuringBuilds`（生產環境）

### 3. 測試策略

**實現方式：**
- 手動測試所有功能流程
- 使用 TypeScript 編譯時檢查類型錯誤
- 使用 Prisma Studio 檢查資料庫資料
- 使用 Vercel Preview Deployments 測試部署

### 4. 除錯工具

**實現方式：**
- 使用 `console.log` 記錄除錯資訊
- 使用 Vercel Logs 查看運行日誌
- 使用 Prisma Studio 查看資料庫資料
- 使用 Chrome DevTools 除錯前端

---

## 技術總結

### 核心技術選擇理由

1. **Next.js 14**：
   - 提供完整的全端解決方案
   - Server Components 減少客戶端 JavaScript 大小
   - 內建 API Routes 簡化後端開發
   - 優秀的 SEO 支援

2. **Prisma ORM**：
   - 類型安全的資料庫查詢
   - 自動生成 TypeScript 類型
   - 優秀的遷移工具
   - 避免 SQL Injection

3. **Tailwind CSS**：
   - 快速開發響應式設計
   - 減少 CSS 檔案大小
   - 統一的設計系統

4. **Redis (Upstash)**：
   - 分散式速率限制
   - 高效能快取
   - 雲端託管，無需自行維護

5. **Vercel**：
   - 自動部署和擴展
   - 全球 CDN 加速
   - 免費層級足夠小型專案使用

### 架構設計原則

1. **分層架構**：表現層、API 層、服務層、資料層清晰分離
2. **單一職責**：每個函數和模組只負責一個功能
3. **DRY 原則**：避免重複程式碼，提取共用邏輯
4. **類型安全**：使用 TypeScript 確保類型正確
5. **錯誤處理**：統一的錯誤處理機制
6. **安全性優先**：所有用戶輸入都經過驗證和清理

### 效能優化策略

1. **資料庫優化**：索引、批量查詢、Select 優化
2. **快取策略**：Redis 快取、HTTP 快取、CDN 快取
3. **程式碼優化**：程式碼分割、Tree Shaking、Minification
4. **圖片優化**：Next.js Image Optimization、WebP 格式

---

**最後更新：** 2025-12-25  
**文件版本：** 1.0 (製作技術指南)



