# 藍新金流 NewebPay MPG 串接說明

## 環境變數

在 `.env` 或 Vercel 環境變數中設定：

- `NEWEBPAY_MERCHANT_ID`：商店代號（例如 MS1814789020）
- `NEWEBPAY_HASH_KEY`：HashKey
- `NEWEBPAY_HASH_IV`：HashIV
- `NEWEBPAY_MPG_GATEWAY`（選填）：MPG 幕前支付網址  
  - 測試：`https://ccore.newebpay.com/MPG/mpg_gateway`  
  - 正式：`https://core.newebpay.com/MPG/mpg_gateway`  
  未設定時預設為測試環境。

## 藍新後台需設定的網址

請在藍新金流後台「商店設定」中填寫以下網址（依實際網域調整）：

| 項目 | 網址 |
|------|------|
| **Notify URL**（伺服器端回調，唯一可信的付款結果） | `https://peiplay.vercel.app/api/payment/newebpay/notify` |
| **Return URL**（消費者付完款後導回，僅顯示畫面用） | `https://peiplay.vercel.app/api/payment/newebpay/return` |

- **Notify URL**：藍新會以 **POST** 方式將加密的 `TradeInfo`、`TradeSha` 傳到此 API，後端會解密、驗證並更新訂單狀態，此為**唯一可信**的付款結果依據。
- **Return URL**：付款完成後消費者會被導回此 API，再重導向至 `/booking/payment-success` 顯示結果，**不可**作為判斷付款成功的依據。

## 流程摘要

1. 使用者在預約頁選擇「藍新 NewebPay」→ 後端建立訂單並產生加密的 TradeInfo、TradeSha。
2. 前端以 **HTML form POST** 導向藍新 MPG Gateway（不可用 fetch）。
3. 使用者在藍新頁面完成付款。
4. 藍新 **Server to Server** 呼叫 **Notify URL** → 後端解密、驗證、更新訂單與預約狀態。
5. 消費者被導向 **Return URL** → 再導向 `/booking/payment-success` 顯示結果。

## 相關檔案

- `lib/newebpay.ts`：AES/SHA256 工具、產生 TradeInfo/TradeSha、解密與驗證
- `app/api/payment/create/route.ts`：建立訂單（支援 `provider: 'ecpay' | 'newebpay'`）
- `app/api/payment/newebpay/notify/route.ts`：Notify URL 處理
- `app/api/payment/newebpay/return/route.ts`：Return URL 處理（重導向至付款結果頁）
