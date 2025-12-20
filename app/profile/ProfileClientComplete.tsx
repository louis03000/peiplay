"use client";
import React from "react";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import MyBookings from "@/app/components/MyBookings";
import OrderHistory from "@/app/components/OrderHistory";
import PartnerPageLayout from "@/components/partner/PartnerPageLayout";
import InfoCard from "@/components/partner/InfoCard";
import SectionTitle from "@/components/partner/SectionTitle";

const ALL_GAMES = [
  "LOL",
  "APEX",
  "傳說對決",
  "PUBG",
  "CS:GO",
  "VALORANT",
  "爐石戰記",
  "DOTA2",
  "其他",
];

const MAX_GAMES = 10;

export default function ProfileClientComplete() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    birthday: "",
    discord: "",
    customerMessage: "",
    games: [] as string[],
    halfHourlyRate: undefined as number | undefined,
    supportsChatOnly: false,
    chatOnlyRate: undefined as number | undefined,
    coverImage: "",
    coverImages: [] as string[], // 最多3張封面照
  });
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [customGame, setCustomGame] = useState("");

  // 註銷帳號相關狀態
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 載入用戶資料
  useEffect(() => {
    if (!session || !mounted) return;

    const loadUserData = async () => {
      try {
        const res = await fetch("/api/user/profile");
        if (res.status === 401) {
          await signOut({ callbackUrl: "/" });
          return;
        }
        const data = await res.json();
        if (res.ok && data.user) {
          setUserData(data.user);
          setFormData({
            name: data.user.name || "",
            phone: data.user.phone || "",
            birthday: data.user.birthday ? data.user.birthday.slice(0, 10) : "",
            discord: data.user.discord || "",
            customerMessage: data.user.partner?.customerMessage || "",
            games: data.user.partner?.games || [],
            halfHourlyRate: data.user.partner?.halfHourlyRate,
            supportsChatOnly: data.user.partner?.supportsChatOnly || false,
            chatOnlyRate: data.user.partner?.chatOnlyRate || undefined,
            coverImage: data.user.partner?.coverImage || "",
            coverImages:
              data.user.partner?.images?.slice(0, 3) ||
              (data.user.partner?.coverImage
                ? [data.user.partner.coverImage]
                : []),
          });
        }
      } catch (error) {
        console.error("載入用戶資料失敗:", error);
      }
    };

    loadUserData();
  }, [session, mounted]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleGameChange = (game: string) => {
    if (formData.games.includes(game)) {
      setFormData((prev) => ({
        ...prev,
        games: prev.games.filter((g) => g !== game),
      }));
    } else if (formData.games.length < MAX_GAMES) {
      setFormData((prev) => ({ ...prev, games: [...prev.games, game] }));
    }
  };

  const handleAddCustomGame = () => {
    const trimmed = customGame.trim();
    if (
      trimmed &&
      !formData.games.includes(trimmed) &&
      trimmed.length <= 50 &&
      formData.games.length < MAX_GAMES
    ) {
      setFormData((prev) => ({ ...prev, games: [...prev.games, trimmed] }));
      setCustomGame("");
    }
  };

  const handleRemoveGame = (game: string) => {
    setFormData((prev) => ({
      ...prev,
      games: prev.games.filter((g) => g !== game),
    }));
  };

  // 處理封面照上傳（多張）
  const handleCoverImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // 檢查是否超過3張限制
    const currentCount = formData.coverImages.length;
    if (currentCount + files.length > 3) {
      setError(`最多只能上傳3張封面照（目前已有 ${currentCount} 張）`);
      return;
    }

    // 檢查檔案大小和類型
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        setError("檔案大小不能超過 5MB");
        return;
      }
      if (!file.type.startsWith("image/")) {
        setError("只能上傳圖片檔案");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const uploadedUrls: string[] = [];

      // 逐一上傳圖片
      for (const file of files) {
        const formDataObj = new FormData();
        formDataObj.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formDataObj,
        });

        if (!res.ok) {
          throw new Error("上傳失敗");
        }

        const data = await res.json();
        uploadedUrls.push(data.url);
      }

      // 更新封面照陣列
      setFormData((prev) => ({
        ...prev,
        coverImages: [...prev.coverImages, ...uploadedUrls].slice(0, 3),
        coverImage: uploadedUrls[0], // 保留第一張作為 coverImage（向後兼容）
      }));
      setSuccess(`成功上傳 ${uploadedUrls.length} 張封面照！`);

      // 重置 input
      e.target.value = "";
    } catch (err) {
      setError("封面照上傳失敗，請重試");
    } finally {
      setLoading(false);
    }
  };

  // 刪除封面照
  const handleRemoveCoverImage = (index: number) => {
    setFormData((prev) => {
      const newImages = prev.coverImages.filter((_, i) => i !== index);
      return {
        ...prev,
        coverImages: newImages,
        coverImage: newImages[0] || "", // 更新第一張作為 coverImage
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setError("");

    try {
      // 準備提交數據：包含 coverImages 陣列
      const submitData = {
        ...formData,
        coverImages: formData.coverImages, // 提交多張封面照
        coverImage: formData.coverImages[0] || formData.coverImage, // 第一張作為 coverImage（向後兼容）
      };

      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess("資料已更新！");
        setEditMode(false);
        // 重新載入用戶資料
        const refreshRes = await fetch("/api/user/profile");
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.user) {
          setUserData(refreshData.user);
        }
      } else {
        setError(data.error || "更新失敗");
      }
    } catch (err) {
      setError("更新失敗");
    } finally {
      setLoading(false);
    }
  };

  // 處理註銷帳號
  const handleDeleteAccount = async () => {
    if (confirmationCode !== "delect_account") {
      setError("確認碼錯誤");
      return;
    }

    setDeleteLoading(true);
    setError("");

    try {
      const res = await fetch("/api/user/delete-account-simple", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationCode }),
      });

      const data = await res.json();

      if (res.ok) {
        // 註銷成功，登出用戶
        window.location.href = "/";
      } else {
        setError(data.error || "註銷失敗");
      }
    } catch (err) {
      setError("註銷失敗");
    } finally {
      setDeleteLoading(false);
    }
  };

  // 如果還在載入或未掛載，顯示載入狀態
  if (status === "loading" || !mounted) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">載入中...</div>
        </div>
      </div>
    );
  }

  // 如果沒有用戶資料，顯示載入狀態
  if (!userData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-white text-lg">載入用戶資料中...</div>
        </div>
      </div>
    );
  }

  const isPartner = !!userData.partner;

  return (
    <PartnerPageLayout
      title="會員中心"
      subtitle={
        isPartner
          ? "管理您的個人資料、預約服務和客戶訂單"
          : "管理您的個人資料、預約記錄和消費紀錄"
      }
      maxWidth="6xl"
    >
      {/* 個人資料區塊 */}
      <InfoCard className="mb-6">
        <SectionTitle
          title="個人資料"
          subtitle="管理您的個人基本資料，這些資訊會用於服務聯繫和身份驗證"
        />

        {!editMode ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 rounded-2xl">
                <span className="block text-gray-600 mb-2 text-sm font-medium">
                  姓名
                </span>
                <span className="text-gray-900 font-semibold text-lg">
                  {userData.name}
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl">
                <span className="block text-gray-600 mb-2 text-sm font-medium">
                  電話
                </span>
                <span className="text-gray-900 font-semibold text-lg">
                  {userData.phone || "-"}
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl">
                <span className="block text-gray-600 mb-2 text-sm font-medium">
                  生日
                </span>
                <span className="text-gray-900 font-semibold text-lg">
                  {userData.birthday ? userData.birthday.slice(0, 10) : "-"}
                </span>
              </div>
              <div className="p-4 bg-gray-50 rounded-2xl">
                <span className="block text-gray-600 mb-2 text-sm font-medium">
                  Discord 名稱(注意大小寫)
                </span>
                <span className="text-gray-900 font-semibold text-lg">
                  {userData.discord || "-"}
                </span>
              </div>
            </div>

            {isPartner && userData.partner?.halfHourlyRate && (
              <InfoCard bgColor="gray" className="mt-6">
                <p className="text-sm font-medium text-gray-600 mb-2">
                  每半小時收費
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  ${userData.partner.halfHourlyRate}
                </p>
              </InfoCard>
            )}

            {isPartner && userData.partner?.supportsChatOnly && (
              <InfoCard bgColor="green" className="mt-6">
                <p className="text-sm font-medium text-gray-600 mb-2">
                  純聊天服務
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  ${userData.partner.chatOnlyRate || 0}/小時
                </p>
              </InfoCard>
            )}

            <InfoCard bgColor="gray" className="mt-6">
              <p className="text-sm font-medium text-gray-600 mb-2">
                留言板（顧客預約時會看到）
              </p>
              <div className="text-gray-900 min-h-[60px]">
                {userData.partner?.customerMessage ? (
                  userData.partner.customerMessage
                ) : (
                  <span className="text-gray-500">（尚未填寫留言）</span>
                )}
              </div>
            </InfoCard>

            <button
              className="w-full py-3 rounded-2xl bg-[#6C63FF] text-white font-bold text-lg mt-6 hover:bg-[#5a52e6] transition-all duration-300 shadow-lg shadow-[#6C63FF]/30"
              onClick={() => setEditMode(true)}
            >
              修改個人資料
            </button>

            {/* 註銷帳號區域 */}
            <InfoCard bgColor="gray" className="mt-8">
              <SectionTitle
                title="⚠️ 危險操作"
                subtitle="註銷帳號將永久刪除您的所有資料，包括個人資料、預約記錄、訂單歷史等，此操作無法復原。"
              />

              {!showDeleteConfirm ? (
                <button
                  className="w-full py-3 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all duration-300"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  註銷帳號
                </button>
              ) : !showFinalConfirm ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <p className="text-red-800 text-sm mb-4">
                    <strong>
                      第一次確認：您確定要註銷帳號嗎？此操作將永久刪除您的所有資料。
                    </strong>
                  </p>
                  <div className="flex gap-3">
                    <button
                      className="flex-1 py-2 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all duration-300"
                      onClick={() => setShowFinalConfirm(true)}
                    >
                      確定註銷
                    </button>
                    <button
                      className="flex-1 py-2 bg-gray-600 text-white font-bold rounded-2xl hover:bg-gray-700 transition-all duration-300"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                  <p className="text-red-800 text-sm mb-4">
                    <strong>
                      第二次確認：請輸入確認碼 delect_account 來完成註銷。
                    </strong>
                  </p>
                  <input
                    type="text"
                    value={confirmationCode}
                    onChange={(e) => setConfirmationCode(e.target.value)}
                    placeholder="請輸入確認碼"
                    className="w-full px-4 py-3 rounded-2xl bg-white text-gray-900 border-2 border-red-500 focus:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-200 mb-4 transition-all duration-300"
                  />
                  {error && (
                    <div className="text-red-600 text-sm mb-4 font-medium">
                      {error}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      className="flex-1 py-2 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all duration-300 disabled:opacity-50"
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading}
                    >
                      {deleteLoading ? "處理中..." : "確定註銷"}
                    </button>
                    <button
                      className="flex-1 py-2 bg-gray-600 text-white font-bold rounded-2xl hover:bg-gray-700 transition-all duration-300"
                      onClick={() => {
                        setShowFinalConfirm(false);
                        setShowDeleteConfirm(false);
                        setConfirmationCode("");
                        setError("");
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </InfoCard>
          </>
        ) : (
          <form
            className="bg-gray-800/60 p-6 rounded-lg"
            onSubmit={handleSubmit}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-300 mb-1">姓名</label>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">電話</label>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">生日</label>
                <input
                  name="birthday"
                  type="date"
                  value={formData.birthday}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Discord 名稱(注意大小寫)</label>
                <input
                  name="discord"
                  value={formData.discord}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {isPartner && (
              <>
                <div className="mt-6">
                  <label className="block text-gray-300 mb-1">每半小時收費</label>
                  <input
                    name="halfHourlyRate"
                    type="number"
                    value={formData.halfHourlyRate ?? ""}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded bg-gray-900 text-white border border-gray-600 focus:border-indigo-500 focus:outline-none"
                    required
                    min={1}
                  />
                </div>
                
                {/* 純聊天服務 */}
                <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      name="supportsChatOnly"
                      checked={formData.supportsChatOnly}
                      onChange={(e) => setFormData(prev => ({ ...prev, supportsChatOnly: e.target.checked }))}
                      className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                    />
                    <label className="ml-2 text-sm font-medium text-gray-700">
                      我願意提供純聊天服務
                    </label>
                  </div>
                  
                  {formData.supportsChatOnly && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        純聊天每小時收費
                      </label>
                      <input
                        name="chatOnlyRate"
                        type="number"
                        value={formData.chatOnlyRate ?? ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded bg-white text-gray-900 border border-gray-300 focus:border-indigo-500 focus:outline-none"
                        placeholder="請設定純聊天每小時收費"
                        min={1}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {isPartner && (
              <div className="mt-6">
                <label className="block text-gray-300 mb-1 font-semibold">
                  擅長遊戲（最多 10 個，每個限 50 字）
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {ALL_GAMES.map((game) => (
                    <button
                      type="button"
                      key={game}
                      className={`px-3 py-1 rounded-full border text-xs font-semibold mr-2 mb-2 ${formData.games.includes(game) ? "bg-indigo-600 text-white border-indigo-600" : "bg-gray-900 text-gray-300 border-gray-700"}`}
                      onClick={() => handleGameChange(game)}
                      disabled={
                        formData.games.length >= MAX_GAMES &&
                        !formData.games.includes(game)
                      }
                    >
                      {game}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={customGame}
                    onChange={(e) => setCustomGame(e.target.value.slice(0, 50))}
                    className="flex-1 px-3 py-1 rounded bg-gray-900 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none text-xs"
                    placeholder="自訂遊戲名稱（限 50 字）"
                    maxLength={50}
                    disabled={formData.games.length >= MAX_GAMES}
                  />
                  <button
                    type="button"
                    className="px-3 py-1 rounded bg-indigo-500 text-white text-xs font-semibold"
                    onClick={handleAddCustomGame}
                    disabled={
                      !customGame.trim() || formData.games.length >= MAX_GAMES
                    }
                  >
                    新增
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.games.map((game) => (
                    <span
                      key={game}
                      className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-semibold flex items-center mr-2 mb-2"
                    >
                      {game}
                      <button
                        type="button"
                        className="ml-2 text-white hover:text-red-300"
                        onClick={() => handleRemoveGame(game)}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
                <div className="text-right text-xs text-gray-400 mt-1">
                  {formData.games.length}/10
                </div>
              </div>
            )}

            {/* 封面照上傳（最多3張） */}
            <div className="mt-6">
              <label className="block text-gray-300 mb-1 font-semibold">
                封面照（最多3張）
              </label>
              <div className="space-y-3">
                {/* 當前封面照預覽 */}
                {formData.coverImages.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {formData.coverImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image}
                          alt={`封面照 ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-600"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveCoverImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          ×
                        </button>
                        {index === 0 && (
                          <div className="absolute bottom-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                            主圖
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 上傳按鈕 */}
                {formData.coverImages.length < 3 && (
                  <div className="flex items-center gap-3">
                    <label className="flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleCoverImageUpload}
                        className="hidden"
                        disabled={loading || formData.coverImages.length >= 3}
                      />
                      <div className="w-full px-4 py-3 border-2 border-dashed border-gray-600 rounded-lg text-center cursor-pointer hover:border-indigo-500 transition-colors">
                        <div className="text-gray-300 text-sm">
                          {formData.coverImages.length > 0
                            ? `上傳更多封面照（${formData.coverImages.length}/3）`
                            : "選擇封面照（可選多張）"}
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          支援 JPG、PNG 格式，每張檔案大小不超過 5MB，最多3張
                        </div>
                      </div>
                    </label>
                  </div>
                )}
                {formData.coverImages.length >= 3 && (
                  <div className="text-yellow-400 text-sm text-center">
                    已達上限（3張），如需更換請先刪除現有圖片
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-gray-300 mb-1 font-semibold">
                留言板（顧客預約時會看到，限 500 字，含空格）
              </label>
              <textarea
                name="customerMessage"
                value={formData.customerMessage}
                onChange={handleInputChange}
                maxLength={500}
                className="w-full rounded bg-gray-900 text-white border border-gray-700 focus:border-indigo-500 focus:outline-none p-3 min-h-[40px] text-sm"
                placeholder="請輸入想對顧客說的話...（限 500 字，含空格）"
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {formData.customerMessage.length}/500
              </div>
            </div>

            {success && (
              <div className="text-green-400 mb-4 text-center">{success}</div>
            )}
            {error && (
              <div className="text-red-400 mb-4 text-center">{error}</div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 rounded text-white font-bold transition"
                disabled={loading}
              >
                {loading ? "儲存中..." : "儲存變更"}
              </button>
              <button
                type="button"
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 rounded text-white font-bold transition"
                onClick={() => setEditMode(false)}
              >
                取消
              </button>
            </div>
          </form>
        )}
      </InfoCard>

      {/* 預約和訂單管理區塊 */}
      <InfoCard className="mt-6">
        <SectionTitle
          title="📋 預約與訂單管理"
          subtitle={
            isPartner
              ? "管理您的服務預約和客戶訂單，查看服務記錄和收入統計"
              : "查看您的預約記錄和消費紀錄，管理服務評價"
          }
        />

        <div className="space-y-8">
          <section>
            <MyBookings showCompletedOnly />
          </section>
          <section>
            <OrderHistory />
          </section>
        </div>
      </InfoCard>
    </PartnerPageLayout>
  );
}
