import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    console.log("✅ user/suspension-status GET api triggered");
    
    // 返回模擬用戶狀態數據
    return NextResponse.json({
      isSuspended: false,
      suspensionReason: null,
      suspensionEndsAt: null,
      remainingDays: 0
    });
  } catch (error) {
    console.error("Error checking suspension status:", error);
    return NextResponse.json({ error: "Error checking suspension status" }, { status: 500 });
  }
} 