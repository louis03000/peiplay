const withNextIntl = require('next-intl/plugin')({
  locales: ['zh-TW', 'zh-CN', 'en'],
  defaultLocale: 'zh-TW'
});

module.exports = withNextIntl({
  // 其他 Next.js 設定
}); 