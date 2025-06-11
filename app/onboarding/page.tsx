"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

const schema = z.object({
  name: z.string().min(2, '姓名至少2字'),
  phone: z.string().min(10, '請輸入有效電話'),
  birthday: z.string().min(1, '請選擇生日'),
  discord: z.string().min(2, '請輸入 Discord 名稱'),
});

type FormData = z.infer<typeof schema>;

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [error, setError] = useState('');
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
    setError('');
    // 先查詢是否已申請過
    const check = await fetch('/api/partners/self').then(res => res.json());
    if (check.partner) {
      alert('你已經申請過，不可重複申請');
      router.replace('/');
      return;
    }
    // 強制 birthday 格式為 YYYY-MM-DD
    let birthday = data.birthday.replaceAll('/', '-');
    if (birthday.length > 10) birthday = birthday.slice(0, 10);
    console.log('送出資料', { name: data.name, phone: data.phone, birthday });
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err?.error || '補資料失敗，請重試');
      alert(err?.error || '補資料失敗，請重試');
      console.error('補資料失敗', err);
      return;
    }
    await update(); // 強制刷新 session
    router.replace('/'); // 直接跳轉首頁
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">補齊個人資料</h1>
        {error && <div className="mb-2 text-red-600">{error}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block mb-1 text-gray-800 font-semibold">姓名</label>
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
            <label className="block mb-1 text-gray-800 font-semibold">Discord 名稱</label>
            <input type="text" {...register('discord')} className="w-full border border-gray-300 rounded px-2 py-1 bg-white text-gray-900 placeholder-gray-400" />
            {errors.discord && <div className="text-red-600 text-sm">{errors.discord.message}</div>}
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded">送出</button>
        </form>
      </div>
    </div>
  );
} 