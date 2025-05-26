'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import ProfileClient from './ProfileClient';

export default function ProfilePage() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    redirect('/auth/login');
  }

  return <ProfileClient />;
} 