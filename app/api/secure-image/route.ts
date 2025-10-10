import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 對於夥伴封面圖片，允許未登入用戶訪問（用於預約頁面）
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: '未授權訪問' }, { status: 401 });
    // }

    // 獲取圖片 URL 參數
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    
    if (!imageUrl) {
      return NextResponse.json({ error: '缺少圖片 URL' }, { status: 400 });
    }

    // 驗證 URL 是否來自允許的域名
    const allowedDomains = ['res.cloudinary.com', 'placehold.co'];
    const urlObj = new URL(imageUrl);
    
    if (!allowedDomains.includes(urlObj.hostname)) {
      return NextResponse.json({ error: '不允許的圖片來源' }, { status: 403 });
    }

    // 獲取圖片
    const imageResponse = await fetch(imageUrl);
    
    if (!imageResponse.ok) {
      return NextResponse.json({ error: '無法獲取圖片' }, { status: 404 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // 返回圖片，並設置安全標頭
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600', // 私有緩存，1小時過期
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        // 防止直接下載的安全標頭
        'Content-Disposition': 'inline', // 強制在瀏覽器中顯示，而不是下載
        'X-Download-Options': 'noopen',
      },
    });

  } catch (error) {
    console.error('安全圖片代理錯誤:', error);
    return NextResponse.json({ error: '圖片處理失敗' }, { status: 500 });
  }
}
