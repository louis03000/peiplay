"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface PartnerReferralConfig {
  id: string;
  name: string;
  referralPlatformFee: number;
  referralBonusPercentage: number;
  referralCount: number;
  totalReferralEarnings: number;
}

export default function ReferralConfigPage() {
  const router = useRouter();
  const sessionData = typeof window !== "undefined" ? useSession() : { data: undefined, status: "unauthenticated" };
  const session = sessionData.data;
  const status = sessionData.status;
  const [partners, setPartners] = useState<PartnerReferralConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPartner, setEditingPartner] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    referralPlatformFee: 10,
    referralBonusPercentage: 5
  });

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    fetchPartners();
  }, [session, status, router]);

  const fetchPartners = async () => {
    try {
      const response = await fetch('/api/admin/referral-config');
      if (response.ok) {
        const data = await response.json();
        setPartners(data);
      } else {
        setError('獲取夥伴推薦配置失敗');
      }
    } catch (err) {
      setError('獲取夥伴推薦配置失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (partner: PartnerReferralConfig) => {
    setEditingPartner(partner.id);
    setEditForm({
      referralPlatformFee: partner.referralPlatformFee,
      referralBonusPercentage: partner.referralBonusPercentage
    });
  };

  const handleSave = async (partnerId: string) => {
    try {
      const response = await fetch('/api/admin/referral-config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerId,
          ...editForm
        }),
      });

      if (response.ok) {
        await fetchPartners();
        setEditingPartner(null);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '更新配置失敗');
      }
    } catch (err) {
      setError('更新配置失敗');
    }
  };

  const handleCancel = () => {
    setEditingPartner(null);
    setEditForm({ referralPlatformFee: 10, referralBonusPercentage: 5 });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">載入中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 頁面標題 */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">推薦系統配置</h1>
          <p className="text-blue-200">管理每個夥伴的推薦抽成比例</p>
        </div>

        {/* 管理功能按鈕 */}
        <div className="mb-6 flex justify-end gap-2">
          <a
            href="/admin/withdrawals"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            提領申請管理
          </a>
          <a
            href="/admin/partners"
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            夥伴管理
          </a>
        </div>

        {/* 配置說明 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">推薦系統說明</h3>
          <ul className="space-y-2 text-blue-800">
            <li>• <strong>平台抽成比例</strong>：被推薦夥伴享受的平台抽成比例（原本15%）</li>
            <li>• <strong>推薦獎勵比例</strong>：推薦人獲得的獎勵比例</li>
            <li>• 兩個比例相加不能超過100%</li>
            <li>• 被推薦夥伴實際獲得 = 100% - 平台抽成比例 - 推薦獎勵比例</li>
          </ul>
        </div>

        {/* 夥伴配置列表 */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">夥伴推薦配置</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    夥伴姓名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    平台抽成比例
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    推薦獎勵比例
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    被推薦夥伴獲得
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    推薦數量
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    總推薦收入
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {partners.map((partner) => {
                  const partnerEarning = 100 - partner.referralPlatformFee - partner.referralBonusPercentage;
                  const isEditing = editingPartner === partner.id;
                  
                  return (
                    <tr key={partner.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{partner.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={editForm.referralPlatformFee}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              referralPlatformFee: parseFloat(e.target.value) || 0
                            })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">{partner.referralPlatformFee}%</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={editForm.referralBonusPercentage}
                            onChange={(e) => setEditForm({
                              ...editForm,
                              referralBonusPercentage: parseFloat(e.target.value) || 0
                            })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">{partner.referralBonusPercentage}%</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${
                          partnerEarning >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {isEditing ? 
                            (100 - editForm.referralPlatformFee - editForm.referralBonusPercentage).toFixed(2) + '%' :
                            partnerEarning.toFixed(2) + '%'
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {partner.referralCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        NT$ {partner.totalReferralEarnings.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSave(partner.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              保存
                            </button>
                            <button
                              onClick={handleCancel}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(partner)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            編輯
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

