'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import ProfileClient from './ProfileClient';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProfilePage() {
  const router = useRouter();
  const sessionData = typeof window !== "undefined" ? useSession() : { data: undefined, status: "unauthenticated" };
  const session = sessionData.data;
  const status = sessionData.status;

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.replace('/auth/login');
    }
  }, [status, session, router]);

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  return <ProfileClient />;
} 