'use client';

import { SessionProvider } from 'next-auth/react';
import OnboardingRedirect from './components/OnboardingRedirect';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OnboardingRedirect />
      {children}
    </SessionProvider>
  );
} 