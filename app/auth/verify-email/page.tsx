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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(600); // 10分鐘 = 600秒
  const [codeSent, setCodeSent] = useState(false);

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
        setMessage('Email 驗證成功！正在跳轉...');
        setTimeout(() => {
          router.push('/auth/login?verified=true');
        }, 2000);
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('驗證失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

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
            </div>
          )}

          {/* 倒數計時 */}
          {codeSent && timeLeft > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-800 text-center">
                <strong>驗證碼已發送</strong><br />
                剩餘時間：<span className="font-mono text-lg">{formatTime(timeLeft)}</span>
              </p>
            </div>
          )}

          {/* 驗證碼過期提示 */}
          {codeSent && timeLeft === 0 && (
            <div className="mb-6 p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800 text-center">
                驗證碼已過期，請重新發送
              </p>
              <button
                onClick={sendVerificationCode}
                disabled={sending}
                className="mt-2 w-full bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? '發送中...' : '重新發送驗證碼'}
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
