'use client';

import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/lib/AuthProvider';
import OnboardingRedirect from './components/OnboardingRedirect';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>
        <OnboardingRedirect />
        {children}
      </AuthProvider>
    </SessionProvider>
  );
} 