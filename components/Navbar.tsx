'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'

export default function Navbar() {
  return <div style={{color: 'white', padding: '2rem', fontSize: '2rem'}}>Navbar 測試</div>;
} 