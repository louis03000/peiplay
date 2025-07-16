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
  discord: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function UpdateProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: session?.user?.name || '',
      phone: '',
      birthday: '',
      discord: session?.user?.discord || '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setError('');
    setSuccess(false);
    
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          birthday: data.birthday,
          discord: data.discord,
        }),
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error || '更新失敗，請重試');
        return;
      }
      
      await update(); // 刷新 session
      setSuccess(true);
      
      // 2秒後跳轉到首頁
      setTimeout(() => {
        router.replace('/');
      }, 2000);
      
    } catch (error) {
      setError('更新失敗，請重試');
    }
  };

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center">載入中...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">更新個人資料</h1>
        
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">更新成功！正在跳轉...</div>}
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block mb-1 text-gray-800 font-semibold">姓名</label>
            <input 
              type="text" 
              {...register('name')} 
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder-gray-400" 
            />
            {errors.name && <div className="text-red-600 text-sm">{errors.name.message}</div>}
          </div>
          
          <div>
            <label className="block mb-1 text-gray-800 font-semibold">電話</label>
            <input 
              type="text" 
              {...register('phone')} 
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder-gray-400" 
            />
            {errors.phone && <div className="text-red-600 text-sm">{errors.phone.message}</div>}
          </div>
          
          <div>
            <label className="block mb-1 text-gray-800 font-semibold">生日</label>
            <input 
              type="date" 
              {...register('birthday')} 
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder-gray-400" 
            />
            {errors.birthday && <div className="text-red-600 text-sm">{errors.birthday.message}</div>}
          </div>
          
          <div>
            <label className="block mb-1 text-gray-800 font-semibold">Discord 名稱 (選填)</label>
            <input 
              type="text" 
              {...register('discord')} 
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-gray-900 placeholder-gray-400" 
            />
            {errors.discord && <div className="text-red-600 text-sm">{errors.discord.message}</div>}
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition-colors"
            disabled={success}
          >
            {success ? '更新成功' : '更新資料'}
          </button>
        </form>
      </div>
    </div>
  );
} 