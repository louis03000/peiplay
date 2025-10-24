import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  console.log("✅ bookings api triggered");
  return NextResponse.json({ ok: true, message: "Bookings API is working", bookings: [] });
}