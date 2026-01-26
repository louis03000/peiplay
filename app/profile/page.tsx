'use client';

import { useSession } from 'next-auth/react';
import ProfileClientComplete from './ProfileClientComplete';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && status !== "loading" && !session) {
      router.replace('/auth/login');
    }
  }, [mounted, status, session, router]);

  // 僅 Google 登入可停留 /profile；from=oauth 且非 Google 則導回首頁
  useEffect(() => {
    if (!mounted || status !== "authenticated" || !session) return;
    const fromOauth = searchParams.get('from') === 'oauth';
    const provider = (session.user as { provider?: string })?.provider;
    if (fromOauth && provider !== 'google') {
      router.replace('/');
    }
  }, [mounted, status, session, searchParams, router]);

  // 如果還在載入或未掛載，顯示載入狀態
  if (status === "loading" || !mounted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">載入中...</div>
        </div>
      </div>
    );
  }

  // 如果未登入，顯示載入狀態（會自動跳轉到登入頁面）
  if (!session) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">重新導向到登入頁面...</div>
        </div>
      </div>
    );
  }

  return <ProfileClientComplete />;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-white text-lg">載入中...</div>
      </div>
    }>
      <ProfileContent />
    </Suspense>
  );
} 