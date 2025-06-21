import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // This is a simplified test endpoint
  console.log("Booking API test endpoint hit!");
  return NextResponse.json({ message: 'Test successful' }, { status: 200 });
}

export async function GET(request: Request) {
    // This is a simplified test endpoint for GET
    return NextResponse.json({ message: 'GET Test successful' }, { status: 200 });
} 