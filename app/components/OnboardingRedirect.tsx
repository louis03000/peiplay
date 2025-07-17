"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OnboardingRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      const user = session?.user;
      if (user && user.provider === 'line') {
        // 檢查當前是否在 onboarding 頁面
        if (window.location.pathname === '/onboarding') {
          console.log('OnboardingRedirect: 當前在 onboarding 頁面，跳過檢查');
          return;
        }
        
        // 從資料庫檢查用戶資料，而不是依賴 session
        fetch('/api/user/profile')
          .then(res => res.json())
          .then(data => {
            if (data.user) {
              const hasPhone = data.user.phone && data.user.phone.trim() !== '';
              const hasBirthday = data.user.birthday && data.user.birthday !== '2000-01-01';
              
              console.log('OnboardingRedirect: 檢查結果:', { hasPhone, hasBirthday, phone: data.user.phone, birthday: data.user.birthday });
              
              if (!hasPhone || !hasBirthday) {
                console.log('OnboardingRedirect: 用戶資料不完整，跳轉到 onboarding');
                router.replace("/onboarding");
              } else {
                console.log('OnboardingRedirect: 用戶資料完整，不需要跳轉');
              }
            }
          })
          .catch(error => {
            console.error('OnboardingRedirect: 檢查用戶資料失敗:', error);
          });
      }
    }
  }, [session, status, router]);

  return null;
} 