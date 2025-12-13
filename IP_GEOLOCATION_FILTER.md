# 🌍 IP 地理位置過濾功能

## 概述

PeiPlay 已實作 IP 地理位置過濾功能，僅允許來自台灣的 IP 地址訪問服務。此功能可以有效防止來自其他國家的未授權訪問。

## 功能特點

- ✅ **僅允許台灣 IP**：自動阻擋所有非台灣 IP 地址
- ✅ **智能快取**：24 小時快取機制，減少 API 調用
- ✅ **開發環境友好**：本地 IP 自動允許訪問
- ✅ **錯誤處理**：查詢失敗時為安全起見拒絕訪問
- ✅ **詳細日誌**：記錄所有被阻擋的請求

## 技術實現

### 核心文件

- `lib/ip-geolocation.ts` - IP 地理位置檢查工具類
- `middleware.ts` - Next.js 中間件，整合 IP 檢查

### 使用的 API

使用 [ip-api.com](http://ip-api.com/) 免費 API 進行 IP 地理位置查詢：
- 免費版本限制：每分鐘 45 次請求
- 無需 API Key
- 支援 IPv4 和 IPv6

## 配置

### 環境變數

在 `.env.local` 或部署環境中添加以下環境變數：

```bash
# 跳過地理位置檢查（僅用於開發/測試）
# 設置為 'true' 時，將跳過 IP 地理位置檢查
SKIP_GEO_CHECK=false
```

### 開發環境

在開發環境中，以下 IP 會自動允許訪問：
- `127.0.0.1` (localhost)
- `::1` (IPv6 localhost)
- `localhost`
- `192.168.x.x` (本地網路)
- `10.x.x.x` (私有網路)
- `172.16.x.x - 172.31.x.x` (私有網路)

### 生產環境

在生產環境中：
1. 確保 `SKIP_GEO_CHECK` 未設置或設置為 `false`
2. 所有非台灣 IP 將被自動阻擋
3. 被阻擋的請求會返回 403 錯誤

## 使用方式

### 自動檢查

IP 地理位置檢查會自動在所有請求的 middleware 中執行，無需額外配置。

### 手動檢查

如果需要手動檢查 IP 地理位置：

```typescript
import { IPGeolocation } from '@/lib/ip-geolocation';
import { NextRequest } from 'next/server';

// 檢查 IP 是否允許
const result = await IPGeolocation.isIPAllowed(request);
if (!result.allowed) {
  // IP 被阻擋
  console.log(`IP ${result.countryCode} 被阻擋`);
}
```

## 錯誤處理

### 地理位置查詢失敗

如果 IP 地理位置查詢失敗（API 錯誤、網路問題等），為安全起見，系統會：
1. 拒絕訪問（返回 403）
2. 記錄錯誤日誌
3. 返回錯誤訊息

### API 限制

如果超過 ip-api.com 的免費限制（每分鐘 45 次），系統會：
1. 使用快取結果（如果有的話）
2. 如果沒有快取，拒絕訪問

## 快取機制

- **快取時間**：24 小時
- **快取內容**：IP 地址對應的國家代碼
- **自動清理**：過期快取自動清理

## 日誌記錄

所有被阻擋的請求都會記錄以下資訊：
- IP 地址
- 國家/地區
- 國家代碼
- 請求路徑
- User-Agent
- 請求 ID

日誌格式：
```
🚫 IP 地理位置阻擋: {
  ip: 'xxx.xxx.xxx.xxx',
  country: 'United States',
  countryCode: 'US',
  path: '/api/...',
  userAgent: '...',
  requestId: '...'
}
```

## 測試

### 測試台灣 IP

可以使用 VPN 連接到台灣，或使用台灣的代理伺服器進行測試。

### 測試非台灣 IP

使用 VPN 連接到其他國家（如美國、日本等），應該會被阻擋。

### 測試本地開發

在本地開發環境中，所有本地 IP 都會自動允許訪問。

## 注意事項

1. **API 限制**：免費版 ip-api.com 有每分鐘 45 次請求的限制
2. **VPN 繞過**：使用台灣 VPN 的用戶可以繞過此限制
3. **效能影響**：首次查詢會有輕微延遲（約 100-500ms），後續查詢使用快取
4. **錯誤處理**：查詢失敗時為安全起見會拒絕訪問

## 未來改進

- [ ] 支援多個地理位置 API 備援
- [ ] 實作更精細的地區控制（如僅允許特定城市）
- [ ] 添加 IP 白名單功能
- [ ] 實作更智能的快取策略
- [ ] 添加管理後台查看被阻擋的 IP

## 相關文件

- [SECURITY_GUIDE.md](./SECURITY_GUIDE.md) - 完整的安全指南
- [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) - 安全檢查清單



