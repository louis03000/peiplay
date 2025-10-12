"use client";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import LineLoginButton from '@/components/LineLoginButton';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const sessionData = typeof window !== "undefined" ? useSession() : { data: undefined, status: "unauthenticated" };
  const session = sessionData.data;
  const status = sessionData.status;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
    }
  }, [status, router]);

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
      if (res.error === '尚未註冊，請先註冊') {
        setErrorMsg('尚未註冊，請先註冊');
      } else {
        setErrorMsg(res.error === 'CredentialsSignin' ? '帳號或密碼錯誤' : res.error);
      }
    } else if (res?.ok) {
      window.location.href = "/";
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f172a] pt-32">
      <div className="w-full max-w-md">
        <div className="bg-[#1e293b] shadow-xl rounded-lg px-8 pt-6 pb-8 mb-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">登入 PeiPlay</h2>
            <p className="text-gray-600">歡迎回來！</p>
          </div>
          <LineLoginButton />
          <div className="w-full border-t border-gray-200 my-8" />
          <h3 className="text-lg font-bold mb-4 text-gray-800">一般登入</h3>
          <form onSubmit={handleCredentialsLogin} className="w-full flex flex-col gap-4">
            {errorMsg && <div className="text-red-500 text-center">{errorMsg}</div>}
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
              className="w-full py-2 rounded bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold"
              disabled={isLoading}
            >
              {isLoading ? '登入中...' : '登入'}
            </button>
          </form>
          <button
            className="mt-4 w-full py-2 rounded bg-gray-800 text-white font-bold hover:bg-gray-700 transition-colors"
            onClick={() => window.location.href = '/auth/register'}
          >
            其他方式註冊
          </button>
          <p className="text-gray-600 text-sm mt-6">登入即表示您同意我們的服務條款和隱私政策</p>
        </div>
      </div>
    </div>
  );
} 