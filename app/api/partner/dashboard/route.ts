import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log("✅ dashboard api triggered");
  return NextResponse.json({ ok: true, message: "Dashboard API is working" });
}
