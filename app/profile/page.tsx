'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import ProfileClientComplete from './ProfileClientComplete';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const router = useRouter();
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