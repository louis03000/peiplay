"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [form, setForm] = useState({
    name: session?.user?.name || "",
    phone: session?.user?.phone || "",
    birthday: session?.user?.birthday ? session.user.birthday.slice(0, 10) : "",
    email: session?.user?.email || "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      router.replace("/");
    } else {
      const data = await res.json();
      setError(data.error || "更新失敗");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded shadow max-w-md w-full space-y-4">
        <h2 className="text-2xl font-bold mb-4">補充基本資料</h2>
        {error && <div className="text-red-600 mb-2">{error}</div>}
        <div>
          <label className="block mb-1">暱稱</label>
          <input name="name" value={form.name} onChange={handleChange} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block mb-1">電話</label>
          <input name="phone" value={form.phone} onChange={handleChange} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block mb-1">生日</label>
          <input name="birthday" type="date" value={form.birthday} onChange={handleChange} required className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block mb-1">Email（選填）</label>
          <input name="email" value={form.email} onChange={handleChange} className="w-full border rounded px-3 py-2" />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2 rounded mt-4">{loading ? "送出中..." : "送出"}</button>
      </form>
    </div>
  );
} 