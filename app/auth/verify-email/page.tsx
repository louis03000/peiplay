'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('驗證碼已發送到您的 Email，請查收');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10分鐘 = 600秒
  const [codeSent, setCodeSent] = useState(true); // 預設為 true，因為註冊時已發送
  const [verificationResult, setVerificationResult] = useState<'pending' | 'success' | 'failed'>('pending');

  // 倒數計時器
  useEffect(() => {
    if (timeLeft > 0 && codeSent) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft, codeSent]);

  // 格式化時間顯示
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 發送驗證碼
  const sendVerificationCode = async () => {
    if (!email) {
      setError('Email 地址無效');
      return;
    }

    try {
      setSending(true);
      setError('');
      setMessage('');

      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setCodeSent(true);
        setTimeLeft(600); // 重置倒數計時
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('發送驗證碼失敗，請稍後再試');
    } finally {
      setSending(false);
    }
  };

  // 驗證 Email
  const verifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !verificationCode) {
      setError('請輸入驗證碼');
      return;
    }

    if (verificationCode.length !== 6) {
      setError('驗證碼必須是 6 位數字');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');

      const response = await fetch('/api/auth/verify-email', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setVerificationResult('success');
        setMessage('Email 驗證成功！');
      } else {
        setVerificationResult('failed');
        setError(data.error);
      }
    } catch (error) {
      setError('驗證失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 驗證成功畫面
  if (verificationResult === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center">
              <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-green-600 mb-4">🎉 驗證成功！</h1>
              <p className="text-gray-600 mb-6">您的 Email 已成功驗證，現在可以登入使用 PeiPlay 了！</p>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/auth/login')}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 font-medium"
                >
                  前往登入
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 font-medium"
                >
                  返回首頁
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 驗證失敗畫面
  if (verificationResult === 'failed') {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center">
              <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-red-600 mb-4">❌ 驗證失敗</h1>
              <p className="text-gray-600 mb-4">{error || '驗證碼不正確或已過期'}</p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setVerificationResult('pending');
                    setError('');
                    setVerificationCode('');
                  }}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 font-medium"
                >
                  重新驗證
                </button>
                <button
                  onClick={() => router.push('/auth/register')}
                  className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 font-medium"
                >
                  重新註冊
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          {/* 標題 */}
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📧</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Email 驗證</h1>
            <p className="mt-2 text-gray-600">
              請驗證您的 Email 地址以完成註冊
            </p>
          </div>

          {/* 重要提示 */}
          <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  ✅ 驗證碼已發送！
                </h3>
                <div className="mt-2 text-sm text-green-700">
                  <p>我們已經將 6 位數驗證碼發送到您的 Email。</p>
                  <p className="mt-1">請直接在下方輸入驗證碼，<strong>無需再次點擊發送</strong>。</p>
                </div>
              </div>
            </div>
          </div>

          {/* Email 顯示 */}
          {email && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>驗證 Email：</strong> {email}
              </p>
            </div>
          )}

          {/* 發送驗證碼按鈕 */}
          {!codeSent && (
            <div className="mb-6">
              <button
                onClick={sendVerificationCode}
                disabled={sending}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? '發送中...' : '發送驗證碼'}
              </button>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-700 text-center">
                  📧 <strong>溫馨提示：</strong>驗證碼將發送到您的 Email，如果沒有收到，請檢查垃圾郵件資料夾。PeiPlay 的驗證郵件可能會被自動分類到垃圾郵件中。
                </p>
              </div>
            </div>
          )}

          {/* 倒數計時 */}
          {codeSent && timeLeft > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800 text-center">
                <strong>驗證碼已發送</strong><br />
                剩餘時間：<span className="font-mono text-lg">{formatTime(timeLeft)}</span>
              </p>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-xs text-blue-700 text-center">
                  💡 <strong>小提醒：</strong>如果沒有收到驗證碼，請檢查您的垃圾郵件資料夾。PeiPlay 的驗證郵件可能會被自動分類到垃圾郵件中。
                </p>
              </div>
            </div>
          )}

          {/* 驗證碼過期提示 */}
          {codeSent && timeLeft === 0 && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-sm text-red-800 text-center font-medium">
                ⏰ 驗證碼已過期（超過 10 分鐘）
              </p>
              <p className="text-xs text-red-600 text-center mt-1">
                請點擊下方按鈕重新發送新的驗證碼
              </p>
              <button
                onClick={sendVerificationCode}
                disabled={sending}
                className="mt-3 w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? '發送中...' : '🔄 重新發送新的驗證碼'}
              </button>
            </div>
          )}

          {/* 驗證碼輸入表單 */}
          {codeSent && timeLeft > 0 && (
            <form onSubmit={verifyEmail} className="space-y-6">
              <div>
                <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-700 mb-2">
                  驗證碼
                </label>
                <input
                  type="text"
                  id="verificationCode"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="請輸入 6 位數驗證碼"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-center text-2xl font-mono tracking-widest text-gray-900 placeholder-gray-400"
                  maxLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || verificationCode.length !== 6}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '驗證中...' : '驗證 Email'}
              </button>
            </form>
          )}

          {/* 訊息顯示 */}
          {message && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-800">{message}</p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-200 rounded-lg">
              <p className="text-sm text-red-900 font-medium">{error}</p>
            </div>
          )}

          {/* 返回登入 */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                if (confirm('您尚未完成 Email 驗證，確定要離開嗎？未驗證的帳號將無法登入。')) {
                  router.push('/auth/login');
                }
              }}
              className="text-sm text-purple-600 hover:text-purple-500"
            >
              ← 返回登入
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 載入中組件
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-2xl">📧</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Email 驗證</h1>
            <p className="mt-2 text-gray-600">載入中...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 主組件，使用 Suspense 包裝
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
