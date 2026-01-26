"use client";
import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import LineLoginButton from '@/components/LineLoginButton';
import GoogleLoginButton from '@/components/GoogleLoginButton';
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionData = typeof window !== "undefined" ? useSession() : { data: undefined, status: "unauthenticated" };
  const session = sessionData.data;
  const status = sessionData.status;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    const provider = (session?.user as { provider?: string })?.provider;
    // 僅首次 Google 登入導向個人中心；一般註冊／帳密登入導向首頁
    if (provider === "google") {
      router.replace("/profile");
    } else {
      router.replace("/");
    }
  }, [status, session?.user, router]);

  // 讀取 URL 中的 error 參數
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) {
      let message = '';
      switch (error) {
        case 'AccessDenied':
          message = '此 Email 已使用一般註冊，請使用 Email 和密碼登入';
          break;
        case 'Configuration':
          message = 'Google 登入設定有誤，請聯繫管理員';
          break;
        case 'OAuthSignin':
          message = 'Google 登入失敗，請重試';
          break;
        case 'OAuthCallback':
          message = 'Google 登入回調失敗，請重試';
          break;
        case 'OAuthCreateAccount':
          message = '無法建立 Google 帳號，請重試';
          break;
        case 'EmailCreateAccount':
          message = '無法建立帳號，請重試';
          break;
        case 'Callback':
          message = '登入回調錯誤，請重試';
          break;
        case 'OAuthAccountNotLinked':
          message = '此 Email 已使用其他方式註冊，請使用原本的登入方式';
          break;
        case 'EmailSignin':
          message = 'Email 登入失敗，請檢查您的 Email';
          break;
        case 'CredentialsSignin':
          message = '帳號或密碼錯誤';
          break;
        case 'SessionRequired':
          message = '請先登入';
          break;
        default:
          message = '登入失敗，請重試';
      }
      setErrorMsg(message);
      // 清除 URL 中的 error 參數
      router.replace('/auth/login', { scroll: false });
    }
  }, [searchParams, router]);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });
    console.log('signIn result', res);
    if (res?.error) {
      // 檢查是否為 Prisma 錯誤或用戶不存在錯誤
      if (res.error === '尚未註冊 請先註冊帳號' || 
          res.error === '尚未註冊，請先註冊' ||
          res.error.includes('recoveryCodes') ||
          res.error.includes('does not exist') ||
          res.error.includes('Invalid `prisma.user.findUnique')) {
        setErrorMsg('尚未註冊 請先註冊帳號');
      } else {
        setErrorMsg(res.error === 'CredentialsSignin' ? '帳號或密碼錯誤' : res.error);
      }
    } else if (res?.ok) {
      window.location.href = "/";
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white pt-32">
      <div className="w-full max-w-md">
        <div className="bg-white shadow-xl rounded-lg px-8 pt-6 pb-8 mb-4 border border-gray-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-black mb-2 text-center">登入 PeiPlay</h2>
            <p className="text-black text-center">歡迎回來！</p>
          </div>
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm text-center">{errorMsg}</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <LineLoginButton />
            <GoogleLoginButton />
          </div>
          <div className="w-full border-t border-gray-300 my-8" />
          <h3 className="text-lg font-bold mb-4 text-black text-center">一般登入</h3>
          <form onSubmit={handleCredentialsLogin} className="w-full flex flex-col gap-4">
            <input
              type="email"
              className="w-full px-4 py-2 rounded bg-white text-black border border-gray-300"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              className="w-full px-4 py-2 rounded bg-white text-black border border-gray-300"
              placeholder="密碼"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              className="w-full py-4 bg-black text-white font-bold border-2 border-black"
              disabled={isLoading}
              style={{backgroundColor: 'black', color: 'white', borderColor: 'black'}}
            >
              {isLoading ? '登入中...' : '登入'}
            </button>
          </form>
          <button
            className="mt-4 w-full py-4 bg-white text-black font-bold border-2 border-black hover:bg-gray-100 transition-colors"
            onClick={() => window.location.href = '/auth/register'}
            style={{backgroundColor: 'white', color: 'black', borderColor: 'black'}}
          >
            其他方式註冊
          </button>
          <p className="text-gray-600 text-sm mt-6 text-center">登入即表示您同意我們的服務條款和隱私政策</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-white pt-32">
        <div className="w-full max-w-md animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4" />
          <div className="h-4 bg-gray-200 rounded mb-8" />
          <div className="h-12 bg-gray-200 rounded mb-4" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
} 