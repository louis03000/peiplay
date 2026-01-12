// k6 負載測試腳本（改進版）
// 執行：k6 run k6/load-test-improved.js --env BASE_URL=https://your-domain.com
// 
// 改進方向：
// 1. 完整模擬前端登入流程（GET /auth/login → POST /api/auth/login-secure）
// 2. API payload 與前端一致
// 3. 增加隨機登入延遲（0~3秒）
// 4. 記錄登入成功率日誌

import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// 自定義指標
const errorRate = new Rate('errors');
const loginSuccessRate = new Rate('login_success');
const loginDuration = new Trend('login_duration');
const instantBookingDuration = new Trend('instant_booking_duration');
const multiPlayerBookingDuration = new Trend('multiplayer_booking_duration');
const queryBookingsDuration = new Trend('query_bookings_duration');

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // 0 -> 10 users
    { duration: '1m', target: 20 },    // 10 -> 20 users
    { duration: '30s', target: 0 },    // 20 -> 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],   // 95% < 2s
    http_req_duration: ['p(99)<5000'],    // 99% < 5s
    errors: ['rate<0.05'],                // error rate < 5%
    http_req_failed: ['rate<0.05'],       // failed requests < 5%
    login_success: ['rate>0.8'],           // 登入成功率 > 80%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// 測試帳號列表（從環境變數或預設值）
const TEST_ACCOUNTS = __ENV.TEST_ACCOUNTS 
  ? JSON.parse(__ENV.TEST_ACCOUNTS)
  : [
      { email: 'test1@example.com', password: 'password123' },
      { email: 'test2@example.com', password: 'password123' },
      { email: 'test3@example.com', password: 'password123' },
    ];

// 真實遊戲名稱列表（從遊戲庫中提取）
const REAL_GAMES = [
  'Fortnite',
  'Minecraft',
  'Roblox',
  'PUBG Mobile',
  'Call of Duty: Mobile',
  'Genshin Impact',
  'Honor of Kings',
  'Arena of Valor',
  'League of Legends',
  'Apex Legends',
  'VALORANT',
  'CS:GO',
];

// 隨機選擇遊戲
function getRandomGame() {
  return REAL_GAMES[Math.floor(Math.random() * REAL_GAMES.length)];
}

// 隨機選擇合法玩家數量（2-5人）
function getRandomPlayerCount() {
  return Math.floor(Math.random() * 4) + 2; // 2-5
}

// 獲取隨機帳號
function getRandomAccount() {
  return TEST_ACCOUNTS[Math.floor(Math.random() * TEST_ACCOUNTS.length)];
}

// 從 Set-Cookie header 中提取所有 cookies
function extractCookies(response) {
  const cookies = {};
  const setCookieHeaders = response.headers['Set-Cookie'];
  
  if (!setCookieHeaders) {
    return cookies;
  }
  
  // 處理單個或多個 Set-Cookie headers
  const cookieArray = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  
  for (const cookieHeader of cookieArray) {
    // 提取 cookie 名稱和值（在分號之前的部分）
    const cookiePart = cookieHeader.split(';')[0].trim();
    const equalIndex = cookiePart.indexOf('=');
    
    if (equalIndex > 0) {
      const name = cookiePart.substring(0, equalIndex).trim();
      const value = cookiePart.substring(equalIndex + 1).trim();
      cookies[name] = value;
    }
  }
  
  return cookies;
}

// 合併 cookies 物件
function mergeCookies(existingCookies, newCookies) {
  return { ...existingCookies, ...newCookies };
}

// 將 cookies 物件轉換為 Cookie header 字串
function formatCookies(cookies) {
  return Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

// 完整登入流程
function login(email, password) {
  const loginStartTime = Date.now();
  
  // 步驟 1: GET /auth/login 獲取初始 cookie 和 CSRF token
  const loginPageRes = http.get(`${BASE_URL}/auth/login`, {
    tags: { name: 'GetLoginPage' },
  });
  
  const loginPageCheck = check(loginPageRes, {
    'login page status 200': (r) => r.status === 200,
  });
  
  if (!loginPageCheck) {
    console.log(`❌ [${email}] 獲取登入頁面失敗: ${loginPageRes.status}`);
    errorRate.add(1);
    return { success: false, cookies: {}, csrfToken: null };
  }
  
  // 提取初始 cookies
  let cookies = extractCookies(loginPageRes);
  
  // 步驟 2: POST /api/auth/login-secure 進行登入
  // 注意：CSRF token 在登入成功後才會設置，所以登入請求不需要 CSRF token
  const loginPayload = JSON.stringify({
    email: email,
    password: password,
  });
  
  const loginHeaders = {
    'Content-Type': 'application/json',
    'Cookie': formatCookies(cookies),
  };
  
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login-secure`,
    loginPayload,
    {
      headers: loginHeaders,
      tags: { name: 'PostLogin' },
    }
  );
  
  const loginDurationMs = Date.now() - loginStartTime;
  loginDuration.add(loginDurationMs);
  
  const loginCheck = check(loginRes, {
    'login status 200': (r) => r.status === 200,
    'login has user data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.user && body.user.id;
      } catch {
        return false;
      }
    },
  });
  
  if (loginCheck && loginRes.status === 200) {
    // 登入成功，更新 cookies 和 CSRF token
    const newCookies = extractCookies(loginRes);
    cookies = mergeCookies(cookies, newCookies);
    
    // 從 cookie 中提取 CSRF token（登入成功後會設置）
    const csrfToken = cookies['csrf-token'] || null;
    
    loginSuccessRate.add(1);
    console.log(`✅ [${loginRes.status}] ${email} - 登入成功`);
    
    return {
      success: true,
      cookies: cookies,
      csrfToken: csrfToken,
      userId: JSON.parse(loginRes.body).user?.id,
    };
  } else {
    loginSuccessRate.add(0);
    errorRate.add(1);
    console.log(`❌ [${loginRes.status}] ${email} - 登入失敗: ${loginRes.body.substring(0, 200)}`);
    return { success: false, cookies: cookies, csrfToken: null };
  }
}

// Instant Booking API
function instantBooking(cookies, csrfToken, partnerId) {
  const startTime = Date.now();
  
  // 從瀏覽器 Network 拷貝的原始 JSON payload
  const payload = JSON.stringify({
    partnerId: partnerId,
    duration: 1, // 1 小時
    isChatOnly: false,
  });
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': formatCookies(cookies),
  };
  
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  const res = http.post(
    `${BASE_URL}/api/bookings/instant`,
    payload,
    {
      headers: headers,
      tags: { name: 'InstantBooking' },
    }
  );
  
  instantBookingDuration.add(Date.now() - startTime);
  
  const checkResult = check(res, {
    'instant booking status 200': (r) => r.status === 200,
    'instant booking has booking id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.booking && body.booking.id;
      } catch {
        return false;
      }
    },
  });
  
  if (!checkResult) {
    errorRate.add(1);
    console.log(`❌ Instant Booking 失敗: ${res.status} - ${res.body.substring(0, 200)}`);
  }
  
  return checkResult;
}

// Multi-player Booking API
function multiPlayerBooking(cookies, csrfToken, partnerScheduleIds, scheduleData) {
  const startTime = Date.now();
  
  // 從第一個時段獲取日期和時間
  // scheduleData 格式: { date: Date, startTime: Date, endTime: Date }
  const firstSchedule = scheduleData[0];
  if (!firstSchedule) {
    console.log('❌ Multi-player Booking 失敗: 沒有時段資料');
    return false;
  }
  
  // 提取日期（YYYY-MM-DD）
  // API 返回的 date 和 startTime 都是 Date 物件或 ISO 字串
  let scheduleDate;
  if (firstSchedule.date) {
    scheduleDate = new Date(firstSchedule.date);
  } else if (firstSchedule.startTime) {
    scheduleDate = new Date(firstSchedule.startTime);
  } else {
    console.log('❌ Multi-player Booking 失敗: 無法提取日期');
    return false;
  }
  const date = scheduleDate.toISOString().split('T')[0];
  
  // 提取時間（HH:mm）
  // startTime 和 endTime 是 Date 物件或 ISO 字串
  const startTimeDate = new Date(firstSchedule.startTime);
  const endTimeDate = new Date(firstSchedule.endTime);
  const startTimeStr = startTimeDate.toTimeString().slice(0, 5); // HH:mm
  const endTimeStr = endTimeDate.toTimeString().slice(0, 5); // HH:mm
  
  // 從瀏覽器 Network 拷貝的原始 JSON payload
  const payload = JSON.stringify({
    date: date,
    startTime: startTimeStr,
    endTime: endTimeStr,
    games: [getRandomGame()], // 使用真實遊戲名稱
    partnerScheduleIds: partnerScheduleIds, // 合法玩家數量（2-5個）
  });
  
  const headers = {
    'Content-Type': 'application/json',
    'Cookie': formatCookies(cookies),
  };
  
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  const res = http.post(
    `${BASE_URL}/api/multi-player-booking`,
    payload,
    {
      headers: headers,
      tags: { name: 'MultiPlayerBooking' },
    }
  );
  
  multiPlayerBookingDuration.add(Date.now() - startTime);
  
  const checkResult = check(res, {
    'multiplayer booking status 200': (r) => r.status === 200,
    'multiplayer booking has booking id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.multiPlayerBooking && body.multiPlayerBooking.id;
      } catch {
        return false;
      }
    },
  });
  
  if (!checkResult) {
    errorRate.add(1);
    console.log(`❌ Multi-player Booking 失敗: ${res.status} - ${res.body.substring(0, 200)}`);
  }
  
  return checkResult;
}

// 獲取夥伴列表（用於獲取有效的 partnerId）
function getPartners(cookies, csrfToken) {
  const headers = {
    'Cookie': formatCookies(cookies),
  };
  
  // GET 請求不需要 CSRF token
  
  const res = http.get(
    `${BASE_URL}/api/partners/list?limit=10`,
    {
      headers: headers,
      tags: { name: 'GetPartners' },
    }
  );
  
  const checkResult = check(res, {
    'get partners status 200': (r) => r.status === 200,
    'get partners has partners array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.partners) && body.partners.length > 0;
      } catch {
        return false;
      }
    },
  });
  
  if (checkResult && res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      return body.partners || [];
    } catch {
      return [];
    }
  }
  
  return [];
}

// 獲取夥伴的時段（用於 multi-player booking）
function getPartnerSchedules(cookies, csrfToken, partnerId, date) {
  const headers = {
    'Cookie': formatCookies(cookies),
  };
  
  // GET 請求不需要 CSRF token
  
  // API 使用 startDate 和 endDate 參數
  const res = http.get(
    `${BASE_URL}/api/partners/${partnerId}/schedules?startDate=${date}&endDate=${date}`,
    {
      headers: headers,
      tags: { name: 'GetPartnerSchedules' },
    }
  );
  
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      // API 返回的格式可能是 { schedules: [...] } 或直接是陣列
      const schedules = body.schedules || body || [];
      // 過濾出未預約的時段
      return schedules.filter(s => !s.isBooked && s.isAvailable);
    } catch {
      return [];
    }
  }
  
  return [];
}

// 查詢預約 API
function queryBookings(cookies, csrfToken) {
  const startTime = Date.now();
  
  const headers = {
    'Cookie': formatCookies(cookies),
  };
  
  // GET 請求不需要 CSRF token
  
  const res = http.get(
    `${BASE_URL}/api/bookings/me`,
    {
      headers: headers,
      tags: { name: 'QueryBookings' },
    }
  );
  
  queryBookingsDuration.add(Date.now() - startTime);
  
  const checkResult = check(res, {
    'query bookings status 200': (r) => r.status === 200,
    'query bookings has bookings array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.bookings);
      } catch {
        return false;
      }
    },
  });
  
  if (!checkResult) {
    errorRate.add(1);
    console.log(`❌ 查詢預約失敗: ${res.status} - ${res.body.substring(0, 200)}`);
  }
  
  return checkResult;
}

// 主測試函數
export default function () {
  // 增加隨機登入延遲（0~3秒），避免瞬間全量登入失敗
  const randomDelay = Math.random() * 3000; // 0-3000ms
  sleep(randomDelay / 1000);
  
  // 獲取隨機測試帳號
  const account = getRandomAccount();
  const { email, password } = account;
  
  // 執行登入流程
  const loginResult = login(email, password);
  
  if (!loginResult.success) {
    console.log(`❌ [${email}] 登入失敗，跳過後續 API 測試`);
    return;
  }
  
  const { cookies, csrfToken } = loginResult;
  
  // 等待一下，確保 session 已建立
  sleep(0.5);
  
  // 測試 1: 查詢預約（不需要 partnerId）
  queryBookings(cookies, csrfToken);
  sleep(1);
  
  // 測試 2: 獲取夥伴列表
  const partners = getPartners(cookies, csrfToken);
  sleep(0.5);
  
  if (partners.length > 0) {
    // 測試 3: Instant Booking（使用真實的 partnerId）
    const randomPartner = partners[Math.floor(Math.random() * partners.length)];
    if (randomPartner && randomPartner.id) {
      instantBooking(cookies, csrfToken, randomPartner.id);
      sleep(1);
    }
    
    // 測試 4: Multi-player Booking（需要獲取有效的 partnerScheduleIds）
    // 生成未來 3 天後的日期
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const date = futureDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // 獲取多個夥伴的時段（2-5個夥伴）
    const playerCount = getRandomPlayerCount();
    const selectedPartners = partners.slice(0, Math.min(playerCount, partners.length));
    const partnerScheduleIds = [];
    const scheduleData = []; // 儲存時段資料，用於提取日期和時間
    
    for (const partner of selectedPartners) {
      if (partner && partner.id) {
        const schedules = getPartnerSchedules(cookies, csrfToken, partner.id, date);
        if (schedules.length > 0) {
          // 選擇第一個可用的時段
          const availableSchedule = schedules[0];
          if (availableSchedule && availableSchedule.id) {
            partnerScheduleIds.push(availableSchedule.id);
            scheduleData.push({
              id: availableSchedule.id,
              date: availableSchedule.date,
              startTime: availableSchedule.startTime,
              endTime: availableSchedule.endTime,
            });
          }
        }
      }
    }
    
    // 如果有足夠的時段，執行 multi-player booking
    if (partnerScheduleIds.length >= 2) {
      multiPlayerBooking(cookies, csrfToken, partnerScheduleIds, scheduleData);
      sleep(1);
    } else {
      console.log(`⚠️ 無法找到足夠的夥伴時段進行 multi-player booking (需要至少 2 個，找到 ${partnerScheduleIds.length} 個)`);
    }
  } else {
    console.log(`⚠️ 無法獲取夥伴列表，跳過 Instant Booking 和 Multi-player Booking 測試`);
  }
}

// 測試總結
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}
