"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PartnerPageLayout from '@/components/partner/PartnerPageLayout';
import InfoCard from '@/components/partner/InfoCard';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const rtnCode = searchParams.get('RtnCode');
    const rtnMsg = searchParams.get('RtnMsg');
    const merchantTradeNo = searchParams.get('MerchantTradeNo');

    if (rtnCode === '1') {
      setStatus('success');
      setMessage('付款成功！預約已確認，等待夥伴確認即可。');
    } else {
      setStatus('failed');
      setMessage(rtnMsg || '付款失敗，請重試或聯繫客服。');
    }
  }, [searchParams]);

  return (
    <PartnerPageLayout
      title="付款結果"
      subtitle=""
      maxWidth="4xl"
    >
      <InfoCard className="p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#6C63FF] mx-auto mb-6"></div>
              <p className="text-gray-600 text-lg">處理中...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-8xl mb-6">✅</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                付款成功！
              </h1>
              <p className="text-gray-700 text-lg mb-6">
                {message}
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
                <p className="text-green-800 text-base font-medium">
                  🎉 恭喜！您的預約已成功建立並完成付款。
                </p>
                <p className="text-green-700 text-sm mt-2">
                  我們已通知夥伴，請等待夥伴確認預約。
                </p>
              </div>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/bookings"
                  className="px-8 py-3 bg-[#6C63FF] text-white rounded-lg font-semibold hover:bg-[#5a52e6] transition-colors"
                >
                  查看我的預約
                </Link>
                <Link
                  href="/booking"
                  className="px-8 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  繼續預約
                </Link>
              </div>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="text-8xl mb-6">❌</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                付款失敗
              </h1>
              <p className="text-gray-700 text-lg mb-6">
                {message}
              </p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                <p className="text-red-800 text-base font-medium">
                  ⚠️ 付款未完成，預約尚未生效。
                </p>
                <p className="text-red-700 text-sm mt-2">
                  請重新嘗試付款，或聯繫客服協助處理。
                </p>
              </div>
              <div className="flex gap-4 justify-center">
                <Link
                  href="/booking"
                  className="px-8 py-3 bg-[#6C63FF] text-white rounded-lg font-semibold hover:bg-[#5a52e6] transition-colors"
                >
                  重新預約
                </Link>
                <Link
                  href="/bookings"
                  className="px-8 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  查看我的預約
                </Link>
              </div>
            </>
          )}
        </div>
      </InfoCard>
    </PartnerPageLayout>
  );
}
