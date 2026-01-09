"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

const schema = z.object({
  name: z.string().min(2, '名字至少2字'),
  phone: z.string().min(10, '請輸入有效電話'),
  birthday: z.string().min(1, '請選擇生日'),
  discord: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: session?.user?.name || '',
      phone: session?.user?.phone || '',
      birthday: session?.user?.birthday ? session.user.birthday.slice(0, 10) : '',
      discord: session?.user?.discord || '',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (isSubmitting) {
      console.log('正在提交中，忽略重複提交');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    // 強制 birthday 格式為 YYYY-MM-DD
    let birthday = data.birthday.replaceAll('/', '-');
    if (birthday.length > 10) birthday = birthday.slice(0, 10);
    
    console.log('送出資料', { name: data.name, phone: data.phone, birthday });
    
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          birthday,
          discord: data.discord,
        }),
      });
      
      console.log('API 回應狀態:', res.status);
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('API 錯誤:', err);
        setError(err?.error || `補資料失敗 (${res.status})`);
        return;
      }
      
      const result = await res.json();
      console.log('API 成功回應:', result);
      
      await update(); // 強制刷新 session
      console.log('Session 已更新，準備跳轉...');
      
      // 立即跳轉到首頁
      console.log('開始跳轉到首頁...');
      window.location.href = '/';
      
    } catch (error) {
      console.error('補資料失敗:', error);
      setError('補資料失敗，請重試');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 pt-32">
      <div className="bg-white p-8 rounded shadow w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">歡迎加入 PeiPlay！</h1>
        <p className="text-gray-600 mb-6">請補齊您的個人資料，讓我們為您提供更好的服務。</p>
        {error && <div className="mb-2 text-red-600">{error}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block mb-1 text-gray-800 font-semibold">名字</label>
            <input type="text" {...register('name')} className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 placeholder-gray-400" />
            {errors.name && <div className="text-red-600 text-sm">{errors.name.message}</div>}
          </div>
          <div>
            <label className="block mb-1 text-gray-800 font-semibold">電話</label>
            <input type="text" {...register('phone')} className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 placeholder-gray-400" />
            {errors.phone && <div className="text-red-600 text-sm">{errors.phone.message}</div>}
          </div>
          <div>
            <label className="block mb-1 text-gray-800 font-semibold">生日</label>
            <input type="date" {...register('birthday')} className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 placeholder-gray-400" />
            {errors.birthday && <div className="text-red-600 text-sm">{errors.birthday.message}</div>}
          </div>
          <div>
            <label className="block mb-1 text-gray-800 font-semibold">Discord 名稱 (選填)</label>
            <input type="text" {...register('discord')} className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 placeholder-gray-400" />
            {errors.discord && <div className="text-red-600 text-sm">{errors.discord.message}</div>}
          </div>
          <button 
            type="submit" 
            className="w-full bg-indigo-600 text-white py-2 rounded disabled:bg-gray-400"
            disabled={isSubmitting}
          >
            {isSubmitting ? '送出中...' : '送出'}
          </button>
        </form>
      </div>
    </div>
  );
} 