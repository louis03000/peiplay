"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Partner {
  id: string;
  name: string;
  birthday: string;
  phone: string;
  coverImage: string;
  games: string[];
  halfHourlyRate: number;
  status: string;
  user: { email: string };
}

export default function AdminPartnersPage() {
  const router = useRouter();
  const sessionData = typeof window !== "undefined" ? useSession() : { data: undefined, status: "unauthenticated" };
  const session = sessionData.data;
  const status = sessionData.status;
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetch("/api/admin/partners?status=PENDING")
      .then((res) => res.json())
      .then((data) => {
        setPartners(data);
        setLoading(false);
      })
      .catch(() => {
        setError("載入失敗");
        setLoading(false);
      });
  }, [session, status, router]);

  const handleReview = async (id: string, status: "APPROVED" | "REJECTED") => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/admin/partners", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      setPartners((prev) => prev.filter((p) => p.id !== id));
    } else {
      setError("審核失敗");
    }
    setLoading(false);
  };

  if (status === "loading" || loading) return <div>載入中...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="max-w-3xl mx-auto py-8 pt-20">
      <h1 className="text-2xl font-bold mb-6">夥伴申請審核</h1>
      <div className="mb-6 flex justify-end">
        <button
          className="px-6 py-2 rounded bg-gradient-to-r from-green-500 to-blue-500 text-white font-bold shadow hover:scale-105 transition-transform"
          onClick={() => {
            window.open('/api/orders/export?export=excel', '_blank');
          }}
        >
          匯出消費紀錄 Excel
        </button>
      </div>
      {!partners.length
        ? <div>目前沒有待審核的申請</div>
        : <div className="space-y-6">
          {partners.map((p) => (
            <div key={p.id} className="border rounded p-4 flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-gray-400">Email: {p.user.email}</div>
                <div className="text-sm">電話: {p.phone}</div>
                <div className="text-sm">生日: {p.birthday?.slice(0, 10)}</div>
                <div className="text-sm">偏好遊戲: {p.games.join(", ")}</div>
                <div className="text-sm">半小時收費: {p.halfHourlyRate}</div>
              </div>
              <div className="flex gap-2 mt-4 md:mt-0">
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  onClick={() => handleReview(p.id, "APPROVED")}
                >通過</button>
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  onClick={() => handleReview(p.id, "REJECTED")}
                >拒絕</button>
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
} 