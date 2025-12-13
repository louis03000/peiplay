const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    },
    // 啟用性能優化
    optimizePackageImports: ['react-icons'],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 編譯優化
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // 圖片優化
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
    ],
    // 為了兼容性也保留 domains（某些版本仍需要）
    domains: ['placehold.co', 'res.cloudinary.com'],
    // 加強圖片安全
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // 性能優化
    formats: ['image/webp', 'image/avif'],
    // 增加圖片快取時間（30天），減少重複下載
    // 根據用戶提供的資料，圖片應該有更長的快取時間
    minimumCacheTTL: 2592000, // 30 天（秒）
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 允許未優化的圖片（用於 Cloudinary）
    unoptimized: false,
  },
  // 壓縮優化
  compress: true,
  // 生產環境優化
  swcMinify: true,
  // 安全標頭與快取策略
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // 強制 HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // 防止 MIME 類型嗅探
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // 防止點擊劫持
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // XSS 保護
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // 引用政策
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // 權限政策
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
          // 內容安全策略
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "connect-src 'self' https: wss:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; '),
          },
        ],
      },
      // 靜態資源快取：Next.js 構建產物（長期快取，使用版本號）
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // 圖片優化快取（Next.js Image Optimization）
      {
        source: '/_next/image(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // 靜態檔案快取（public 目錄下的資源）
      {
        source: '/:path*\\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // 字體檔案快取
      {
        source: '/:path*\\.(woff|woff2|ttf|eot|otf)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // API 路由：預設不快取（但個別 API 可以覆蓋）
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
        ],
      },
      // 可快取的公開 API（讀取類，不涉及個人資料）
      {
        source: '/api/(announcements|games/list|partners/ranking|partners/average-rating)(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
        ],
      },
    ];
  },
  // 強制 HTTPS 重定向
  async redirects() {
    return [
      {
        source: '/(.*)',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://peiplay.vercel.app/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = withNextIntl(nextConfig); 