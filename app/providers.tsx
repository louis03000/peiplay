'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  useEffect(() => {
    console.log('session', session);
    if (
      status === 'authenticated' &&
      session?.user &&
      (!session.user.phone || !session.user.birthday) &&
      window.location.pathname !== '/onboarding'
    ) {
      router.replace('/onboarding');
    }
  }, [session, status, router]);
  return <>{children}</>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <OnboardingGuard>{children}</OnboardingGuard>
    </SessionProvider>
  );
} 