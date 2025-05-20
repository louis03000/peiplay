'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

const locales = [
  { code: 'zh-TW', label: '繁體' },
  { code: 'zh-CN', label: '简体' },
  { code: 'en', label: 'EN' }
]

export default function LanguageSwitcher() {
  const pathname = usePathname()
  const router = useRouter()
  const currentLocale = useLocale()

  const handleLocaleChange = (locale: string) => {
    const path = pathname ?? '/';
    const pathWithoutLocale = path.replace(`/${currentLocale}`, '')
    router.push(`/${locale}${pathWithoutLocale}`)
  }

  return (
    <div className="flex items-center space-x-2">
      {locales.map((locale) => (
        <button
          key={locale.code}
          onClick={() => handleLocaleChange(locale.code)}
          className={`px-2 py-1 rounded ${
            currentLocale === locale.code
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          {locale.label}
        </button>
      ))}
    </div>
  )
} 