import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-indigo-900">
      <h1 className="text-4xl font-bold text-white mb-4">404 - 找不到頁面</h1>
      <p className="text-lg text-gray-300 mb-8">您所查詢的頁面不存在。</p>
      <Link href="/" className="text-indigo-400 underline">回首頁</Link>
    </div>
  );
} 