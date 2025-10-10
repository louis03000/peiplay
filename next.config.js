const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    },
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['placehold.co', 'res.cloudinary.com'],
    // 加強圖片安全
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // 安全標頭
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