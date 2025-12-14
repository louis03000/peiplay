// k6 聊天室壓力測試腳本
// 執行：k6 run k6/chat-load-test.js

import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // 0 -> 50 users
    { duration: '1m', target: 100 },   // 50 -> 100 users
    { duration: '30s', target: 0 },     // 100 -> 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% < 500ms
    http_req_duration: ['p(99)<1000'],  // 99% < 1s
    errors: ['rate<0.01'],              // error rate < 1%
    http_req_failed: ['rate<0.01'],     // failed requests < 1%
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://api.peiplay.com';
const TOKEN = __ENV.TOKEN || 'YOUR_TEST_TOKEN';
const ROOM_ID = __ENV.ROOM_ID || 'test-room-id';

export default function () {
  const params = {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    tags: { name: 'ChatAPI' },
  };

  // 1. Fetch messages (GET /messages)
  const messagesRes = http.get(
    `${BASE_URL}/api/chat/rooms/${ROOM_ID}/messages?limit=30`,
    params
  );
  
  const messagesCheck = check(messagesRes, {
    'messages status 200': (r) => r.status === 200,
    'messages duration < 300ms': (r) => r.timings.duration < 300,
    'messages has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.messages && Array.isArray(body.messages);
      } catch {
        return false;
      }
    },
  });

  if (!messagesCheck) {
    errorRate.add(1);
  }

  sleep(1);

  // 2. Send message (POST /messages)
  const sendRes = http.post(
    `${BASE_URL}/api/chat/rooms/${ROOM_ID}/messages`,
    JSON.stringify({ 
      content: `test message ${Date.now()} - ${Math.random().toString(36).substring(7)}` 
    }),
    params
  );

  const sendCheck = check(sendRes, {
    'send status 200': (r) => r.status === 200,
    'send duration < 200ms': (r) => r.timings.duration < 200,
    'send has message': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.message && body.message.id;
      } catch {
        return false;
      }
    },
  });

  if (!sendCheck) {
    errorRate.add(1);
  }

  sleep(2);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}

