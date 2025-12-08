'use client';

import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/lib/AuthProvider';
import OnboardingRedirect from './components/OnboardingRedirect';

// 動態導入 SWR（如果已安裝）
let SWRConfig: any = null;
try {
  const swr = require('swr');
  SWRConfig = swr.SWRConfig;
} catch {
  // SWR 未安裝，將在安裝後自動啟用
  console.log('SWR not installed. Run: npm install swr');
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // 如果 SWR 已安裝，使用 SWRConfig
  if (SWRConfig) {
    // 動態導入配置（避免未安裝時錯誤）
    const { swrConfig, authenticatedFetcher } = require('@/lib/swr-config');
    
    return (
      <SessionProvider>
        <SWRConfig 
          value={{
            ...swrConfig,
            fetcher: authenticatedFetcher,
          }}
        >
          <AuthProvider>
            <OnboardingRedirect />
            {children}
          </AuthProvider>
        </SWRConfig>
      </SessionProvider>
    );
  }
  
  // 如果 SWR 未安裝，使用基本配置
  return (
    <SessionProvider>
      <AuthProvider>
        <OnboardingRedirect />
        {children}
      </AuthProvider>
    </SessionProvider>
  );
} 