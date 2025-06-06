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
  hourlyRate: z.number().min(0, '請輸入有效的小時費用'),
  games: z.array(z.string()),
  coverImage: z.string().url('請輸入有效的圖片網址'),
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
      hourlyRate: 0,
      games: [],
      coverImage: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        hourlyRate: data.hourlyRate,
        games: data.games,
        coverImage: data.coverImage,
      }),
    });
    if (!res.ok) {
      setError('補資料失敗，請重試');
      return;
    }
    await update(); // 強制刷新 session
    router.replace('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4">補齊個人資料</h1>
        {error && <div className="mb-2 text-red-600">{error}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block mb-1">姓名</label>
            <input type="text" {...register('name')} className="w-full border rounded px-2 py-1" />
            {errors.name && <div className="text-red-600 text-sm">{errors.name.message}</div>}
          </div>
          <div>
            <label className="block mb-1">電話</label>
            <input type="text" {...register('phone')} className="w-full border rounded px-2 py-1" />
            {errors.phone && <div className="text-red-600 text-sm">{errors.phone.message}</div>}
          </div>
          <div>
            <label className="block mb-1">生日</label>
            <input type="date" {...register('birthday')} className="w-full border rounded px-2 py-1" />
            {errors.birthday && <div className="text-red-600 text-sm">{errors.birthday.message}</div>}
          </div>
          <div>
            <label className="block mb-1">小時費用</label>
            <input type="number" {...register('hourlyRate')} className="w-full border rounded px-2 py-1" />
            {errors.hourlyRate && <div className="text-red-600 text-sm">{errors.hourlyRate.message}</div>}
          </div>
          <div>
            <label className="block mb-1">遊戲</label>
            <input type="text" {...register('games')} className="w-full border rounded px-2 py-1" />
            {errors.games && <div className="text-red-600 text-sm">{errors.games.message}</div>}
          </div>
          <div>
            <label className="block mb-1">封面圖片</label>
            <input type="text" {...register('coverImage')} className="w-full border rounded px-2 py-1" />
            {errors.coverImage && <div className="text-red-600 text-sm">{errors.coverImage.message}</div>}
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded">送出</button>
        </form>
      </div>
    </div>
  );
} 