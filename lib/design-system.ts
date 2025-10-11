// PeiPlay 設計系統
// 統一的顏色、字體、間距等設計規範

export const colors = {
  // 主色調 - 清爽的藍色系
  primary: {
    50: '#eff6ff',
    100: '#dbeafe', 
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  
  // 輔助色調 - 靛青色
  secondary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  
  // 中性色
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
  
  // 狀態色
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
}

export const spacing = {
  xs: '0.5rem',    // 8px
  sm: '0.75rem',   // 12px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
}

export const borderRadius = {
  sm: '0.375rem',  // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
}

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
}

// 預定義的 CSS 類別
export const classes = {
  // 按鈕樣式
  button: {
    primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200',
    secondary: 'bg-white text-blue-600 hover:bg-blue-50 border-2 border-blue-600 font-semibold py-3 px-6 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200',
    ghost: 'text-blue-600 hover:bg-blue-50 font-semibold py-3 px-6 rounded-xl transition-all duration-200',
  },
  
  // 卡片樣式
  card: {
    default: 'bg-white rounded-xl shadow-lg border border-gray-200 p-6',
    elevated: 'bg-white rounded-xl shadow-xl border border-gray-200 p-6',
    glass: 'bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 p-6',
  },
  
  // 輸入框樣式
  input: {
    default: 'w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200',
    error: 'w-full px-4 py-3 border border-red-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200',
  },
  
  // 背景樣式
  background: {
    page: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100',
    section: 'py-16',
    sectionAlt: 'py-16 bg-white/50',
    sectionAccent: 'py-16 bg-gradient-to-r from-blue-50 to-indigo-50',
  },
  
  // 文字樣式
  text: {
    heading: 'text-gray-900 font-bold',
    subheading: 'text-gray-800 font-semibold',
    body: 'text-gray-600',
    muted: 'text-gray-500',
  },
}

// 響應式斷點
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
}

export default {
  colors,
  spacing,
  borderRadius,
  shadows,
  classes,
  breakpoints,
}
