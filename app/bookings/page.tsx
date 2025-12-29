"use client";

import React from "react";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import PartnerPageLayout from "@/components/partner/PartnerPageLayout";
import InfoCard from "@/components/partner/InfoCard";

type Booking = {
  id: string;
  status: string;
  createdAt: string;
  serviceType?: string; // 服務項目：一般預約、即時預約、群組預約、多人陪玩、純聊天
  partnerResponseDeadline?: string | null; // 期限：夥伴需要在幾點幾分前決定是否接受
  schedule: {
    date: string;
    startTime: string;
    endTime: string;
    partner: {
      name: string;
    };
  };
  customer: {
    name: string;
  };
};

export default function BookingsPage() {
  const { data: session, status } = useSession();
  const [tab, setTab] = useState<"me" | "partner">("me");
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<string | null>(
    null,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [hoveredRejectReason, setHoveredRejectReason] = useState<string | null>(
    null,
  );
  const [clickedRejectReason, setClickedRejectReason] = useState<string | null>(
    null,
  );
  const [popupPosition, setPopupPosition] = useState<{
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
  } | null>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // 使用 ref 追蹤正在進行的請求，防止重複請求
  const abortControllerRef = useRef<AbortController | null>(null);
  const isLoadingRef = useRef(false);

  // 計算彈窗位置，確保完整顯示
  useEffect(() => {
    if (typeof window === "undefined") return;

    const calculatePosition = () => {
      if (hoveredRejectReason || clickedRejectReason) {
        const bookingId = hoveredRejectReason || clickedRejectReason;
        if (!bookingId) return;

        const button = buttonRefs.current.get(bookingId);
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const isMobile = window.innerWidth < 768;

        if (isMobile) {
          // 手機版：居中顯示
          setPopupPosition({
            top: window.innerHeight / 2,
            left: window.innerWidth / 2,
          });
        } else {
          // 桌面版：計算位置，確保不超出視窗
          const popupWidth = 400;
          const popupHeight = 200;
          const spaceAbove = rect.top;
          const spaceBelow = window.innerHeight - rect.bottom;
          const spaceLeft = rect.left;
          const spaceRight = window.innerWidth - rect.right;

          // 優先顯示在按鈕上方
          if (spaceAbove > popupHeight + 10) {
            setPopupPosition({
              bottom: window.innerHeight - rect.top + 10,
              left: Math.max(
                10,
                Math.min(rect.left, window.innerWidth - popupWidth - 10),
              ),
            });
          } else if (spaceBelow > popupHeight + 10) {
            // 顯示在下方
            setPopupPosition({
              top: rect.bottom + 10,
              left: Math.max(
                10,
                Math.min(rect.left, window.innerWidth - popupWidth - 10),
              ),
            });
          } else {
            // 空間都不夠，顯示在按鈕右側
            if (spaceRight > popupWidth + 10) {
              setPopupPosition({
                top: Math.max(
                  10,
                  Math.min(rect.top, window.innerHeight - popupHeight - 10),
                ),
                left: rect.right + 10,
              });
            } else if (spaceLeft > popupWidth + 10) {
              // 顯示在左側
              setPopupPosition({
                top: Math.max(
                  10,
                  Math.min(rect.top, window.innerHeight - popupHeight - 10),
                ),
                right: window.innerWidth - rect.left + 10,
              });
            } else {
              // 最後選擇：居中顯示
              setPopupPosition({
                top: window.innerHeight / 2,
                left: window.innerWidth / 2,
              });
            }
          }
        }
      } else {
        setPopupPosition(null);
      }
    };

    calculatePosition();

    // 視窗大小改變時重新計算位置
    window.addEventListener("resize", calculatePosition);
    window.addEventListener("scroll", calculatePosition, true);

    return () => {
      window.removeEventListener("resize", calculatePosition);
      window.removeEventListener("scroll", calculatePosition, true);
    };
  }, [hoveredRejectReason, clickedRejectReason]);

  // 根據身分預設分頁
  useEffect(() => {
    if (status === "authenticated") {
      if (session?.user?.role === "PARTNER") setTab("partner");
      else setTab("me");
    }
  }, [status, session]);

  // 取得資料 - 改善載入邏輯，防止重複請求
  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }

    // 取消前一個請求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 如果已經在載入，不要重複請求
    if (isLoadingRef.current) {
      console.log("⚠️ 已有請求正在進行，跳過重複請求");
      return;
    }

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);

    // 創建新的 AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 不要立即清空現有數據，避免閃爍
    const url = tab === "me" ? "/api/bookings/me" : "/api/bookings/partner";

    fetch(url, {
      signal: abortController.signal,
      cache: "no-store",
    })
      .then((res) => {
        // 如果請求被取消，不處理響應
        if (abortController.signal.aborted) {
          return null;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        // 如果請求被取消，不更新狀態
        if (abortController.signal.aborted) {
          return;
        }

        console.log(`✅ ${url} 數據載入完成:`, data);
        // 確保數據有效才更新
        if (data && Array.isArray(data.bookings)) {
          setBookings(data.bookings);
        } else {
          setBookings([]);
        }
        setError(null);
      })
      .catch((err) => {
        // 如果請求被取消（AbortError），不顯示錯誤
        if (err.name === "AbortError" || abortController.signal.aborted) {
          console.log("📋 請求已取消（可能是用戶切換分頁）");
          return;
        }

        console.error("載入預約資料失敗:", err);
        setError("載入失敗");
        // 只有在真正的錯誤時才清空，不要清空已有數據
      })
      .finally(() => {
        // 只有在這個請求還有效時才更新載入狀態
        if (!abortController.signal.aborted) {
          setLoading(false);
          isLoadingRef.current = false;
        }
      });

    // 清理函數
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      isLoadingRef.current = false;
    };
  }, [status, tab]);

  // 檢查是否可以取消預約
  const canCancel = (booking: any) => {
    if (
      booking.status === "CANCELLED" ||
      booking.status === "COMPLETED" ||
      booking.status === "REJECTED"
    ) {
      return false;
    }

    const now = new Date();
    const bookingStartTime = new Date(booking.schedule.startTime);
    const hoursUntilBooking =
      (bookingStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // 距離預約時間少於 2 小時不能取消
    return hoursUntilBooking >= 2;
  };

  // 打開取消預約 Modal
  const handleCancelBookingClick = (bookingId: string) => {
    setCancelBookingId(bookingId);
    setCancelReason('');
    setShowCancelModal(true);
  };

  // 確認取消預約
  const handleCancelBooking = async () => {
    if (!cancelBookingId) return;
    
    if (!cancelReason.trim()) {
      alert("請提供取消理由");
      return;
    }

    setCancellingBooking(cancelBookingId);
    try {
      const response = await fetch(`/api/bookings/${cancelBookingId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: cancelReason.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert("預約已成功取消！");
        // 直接更新本地狀態，將預約狀態改為已取消
        setBookings((prevBookings) =>
          prevBookings.map((booking) =>
            booking.id === cancelBookingId
              ? { ...booking, status: "CANCELLED" }
              : booking,
          ),
        );
        setShowCancelModal(false);
        setCancelBookingId(null);
        setCancelReason('');
      } else {
        alert(data.error || "取消預約失敗");
      }
    } catch (error) {
      alert("取消預約時發生錯誤，請稍後再試");
    } finally {
      setCancellingBooking(null);
    }
  };

  // 合併連續時段的預約
  // 🔥 修改：不要合併需要夥伴確認的預約，讓每個預約獨立顯示，夥伴可以分別同意或拒絕
  function mergeBookings(bookings: any[]) {
    if (!bookings.length) return [];
    const sorted = [...bookings].sort((a, b) => {
      const t1 = new Date(a.schedule.startTime).getTime();
      const t2 = new Date(b.schedule.startTime).getTime();
      const partnerA = (a.schedule?.partner?.name || "").trim().toLowerCase();
      const partnerB = (b.schedule?.partner?.name || "").trim().toLowerCase();
      return partnerA.localeCompare(partnerB) || t1 - t2;
    });
    const merged = [];
    let i = 0;
    while (i < sorted.length) {
      let curr = sorted[i];
      let j = i + 1;
      let mergedStartTime = curr.schedule.startTime;
      let mergedEndTime = curr.schedule.endTime;
      const partnerA = (curr.schedule?.partner?.name || "")
        .trim()
        .toLowerCase();
      
      // 🔥 檢查當前預約是否需要夥伴確認
      const needsConfirmation = curr.status === 'PAID_WAITING_PARTNER_CONFIRMATION' || 
                                curr.status === 'PENDING';
      
      // 只有在不需要確認且狀態相同時才合併
      while (
        j < sorted.length &&
        (sorted[j].schedule?.partner?.name || "").trim().toLowerCase() === partnerA &&
        new Date(mergedEndTime).getTime() === new Date(sorted[j].schedule.startTime).getTime()
      ) {
        const nextNeedsConfirmation = sorted[j].status === 'PAID_WAITING_PARTNER_CONFIRMATION' || 
                                      sorted[j].status === 'PENDING';
        
        // 🔥 如果下一個預約需要確認，或者狀態不同，不合併
        if (nextNeedsConfirmation || needsConfirmation || curr.status !== sorted[j].status) {
          break;
        }
        
        mergedEndTime = sorted[j].schedule.endTime;
        j++;
      }
      merged.push({
        ...curr,
        schedule: {
          ...curr.schedule,
          startTime: mergedStartTime,
          endTime: mergedEndTime,
        },
      });
      i = j;
    }
    return merged;
  }

  // 取得狀態中文說明
  function getStatusText(status: string) {
    // 根據用戶角色和分頁顯示不同的狀態文字
    const isPartnerView = tab === "partner";

    const statusMap: { [key: string]: string } = {
      PENDING: "待確認",
      PAID_WAITING_PARTNER_CONFIRMATION: isPartnerView
        ? "待您確認"
        : "等待夥伴確認",
      PARTNER_ACCEPTED: "夥伴已接受",
      PARTNER_REJECTED: "夥伴已拒絕",
      CONFIRMED: "已確認",
      REJECTED: "已拒絕",
      CANCELLED: "已被取消",
      COMPLETED: "已完成",
      PENDING_PAYMENT: "待付款",
    };
    return statusMap[status] || status;
  }

  // 分頁資料
  let filteredBookings = bookings;
  if (tab === "me") {
    const now = new Date();
    filteredBookings = bookings.filter((b) => {
      const start = new Date(b.schedule.startTime);
      // 只顯示未來的預約，不顯示過去的預約
      return start.getTime() > now.getTime();
    });
  }
  const pagedBookings = mergeBookings(filteredBookings).slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const totalPages = Math.ceil(
    mergeBookings(filteredBookings).length / pageSize,
  );

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6C63FF] mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center">
        <div className="text-center text-gray-600">請先登入以查詢預約。</div>
      </div>
    );
  }

  return (
    <PartnerPageLayout
      title="預約管理"
      subtitle={
        session?.user?.role === "PARTNER"
          ? "管理您的預約服務和客戶訂單"
          : "查看您當前有效的預約訂單和服務記錄"
      }
      maxWidth="6xl"
    >
      {/* Tab 切換按鈕 */}
      <div className="flex justify-center gap-4 sm:gap-6 mb-6 sm:mb-8">
        <button
          className={`px-6 sm:px-10 py-4 rounded-2xl font-bold transition-all duration-300 border-2 ${
            tab === "me"
              ? "bg-[#6C63FF] text-white border-[#6C63FF] shadow-lg shadow-[#6C63FF]/30 hover:bg-[#5a52e6]"
              : "bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300 hover:border-gray-400"
          }`}
          onClick={() => setTab("me")}
        >
          <div className="text-center">
            <div className="text-base sm:text-lg font-semibold">我的預約</div>
            <div className="text-xs opacity-90 hidden sm:block mt-1">
              我預約的夥伴
            </div>
          </div>
        </button>
        <button
          className={`px-6 sm:px-10 py-4 rounded-2xl font-bold transition-all duration-300 border-2 ${
            tab === "partner"
              ? "bg-[#6C63FF] text-white border-[#6C63FF] shadow-lg shadow-[#6C63FF]/30 hover:bg-[#5a52e6]"
              : "bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300 hover:border-gray-400"
          }`}
          onClick={() => setTab("partner")}
        >
          <div className="text-center">
            <div className="text-base sm:text-lg font-semibold">我的訂單</div>
            <div className="text-xs opacity-90 hidden sm:block mt-1">
              預約我的顧客
            </div>
          </div>
        </button>
      </div>

      {/* 功能說明 */}
      <InfoCard className="mb-6 bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <div className="text-blue-600 text-xl">ℹ️</div>
          <div className="text-blue-900">
            <div className="font-semibold mb-1">
              {tab === "me" ? "我的預約" : "我的訂單"} 說明：
            </div>
            <div className="text-sm">
              {tab === "me"
                ? "顯示您當前有效的預約訂單（未取消、未拒絕、未完成）。您可以查看預約狀態、時間安排等資訊。距離預約時間 2 小時前可以取消預約。"
                : "顯示您作為夥伴，被哪些顧客預約了服務時段。您可以查看客戶資訊、預約狀態等詳細資料。"}
            </div>
          </div>
        </div>
      </InfoCard>

      {/* 資料表格 */}
      <InfoCard className="overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6C63FF] mx-auto mb-4"></div>
              <p className="text-gray-600">
                正在載入{tab === "me" ? "預約" : "訂單"}資料...
              </p>
            </div>
          ) : error ? (
            <div className="text-center p-8">
              <p className="text-red-400">{error}</p>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center p-8">
              <div className="text-gray-400 text-6xl mb-4">📋</div>
              <p className="text-gray-400 text-lg">
                目前沒有任何{tab === "me" ? "預約" : "訂單"}記錄
              </p>
              <p className="text-gray-500 text-sm mt-2">
                {tab === "me"
                  ? "您還沒有預約任何夥伴的服務"
                  : "還沒有顧客預約您的服務"}
              </p>
            </div>
          ) : (
            <div className="relative">
              {/* 載入遮罩 */}
              {loading && (
                <div className="absolute inset-0 bg-gray-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <div className="text-white text-sm">載入中...</div>
                  </div>
                </div>
              )}

              <table className="w-full text-sm text-left text-white">
                <thead className="text-xs text-gray-100 uppercase bg-gray-700/50">
                  <tr>
                    {tab === "partner" && (
                      <th className="py-3 px-6">顧客姓名</th>
                    )}
                    {tab === "me" && <th className="py-3 px-6">夥伴姓名</th>}
                    <th className="py-3 px-6">預約日期</th>
                    <th className="py-3 px-6">服務項目</th>
                    <th className="py-3 px-6">服務時段</th>
                    <th className="py-3 px-6">預約狀態</th>
                    {tab === "partner" && (
                      <th className="py-3 px-6">期限</th>
                    )}
                    <th className="py-3 px-6">建立時間</th>
                    {(tab === "me" || tab === "partner") && (
                      <th className="py-3 px-6">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pagedBookings.map((booking) => (
                    <tr
                      key={
                        booking.id +
                        booking.schedule.startTime +
                        booking.schedule.endTime
                      }
                      className="bg-gray-800/60 border-b border-gray-700 hover:bg-gray-700/80 transition-colors"
                    >
                      {tab === "partner" && (
                        <td className="py-4 px-6 font-semibold text-white">
                          {booking.customer?.name || "匿名顧客"}
                        </td>
                      )}
                      {tab === "me" && (
                        <td className="py-4 px-6 font-semibold text-white">
                          {booking.schedule?.partner?.name || "未知夥伴"}
                        </td>
                      )}
                      <td className="py-4 px-6 text-white font-medium">
                        {booking.schedule?.startTime
                          ? new Date(
                              booking.schedule.startTime,
                            ).toLocaleDateString("zh-TW", {
                              timeZone: 'Asia/Taipei',
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="py-4 px-6 text-white font-medium">
                        <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {booking.serviceType || '一般預約'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-white font-medium">
                        {booking.schedule?.startTime &&
                        booking.schedule?.endTime
                          ? (() => {
                              // 使用固定時區（Asia/Taipei）確保時間顯示一致
                              const startTime = new Date(booking.schedule.startTime);
                              const endTime = new Date(booking.schedule.endTime);
                              const startStr = startTime.toLocaleTimeString('zh-TW', { 
                                timeZone: 'Asia/Taipei',
                                hour: "2-digit", 
                                minute: "2-digit", 
                                hour12: false 
                              });
                              const endStr = endTime.toLocaleTimeString('zh-TW', { 
                                timeZone: 'Asia/Taipei',
                                hour: "2-digit", 
                                minute: "2-digit", 
                                hour12: false 
                              });
                              return `${startStr} - ${endStr}`;
                            })()
                          : "-"}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            booking.status === "CONFIRMED"
                              ? "bg-green-600 text-white"
                              : booking.status ===
                                  "PAID_WAITING_PARTNER_CONFIRMATION"
                                ? "bg-orange-600 text-white"
                                : booking.status === "PENDING"
                                  ? "bg-yellow-600 text-white"
                                  : booking.status === "REJECTED"
                                    ? "bg-red-500 text-white"
                                    : booking.status === "CANCELLED"
                                      ? "bg-red-600 text-white"
                                      : booking.status === "COMPLETED"
                                        ? "bg-green-600 text-white"
                                        : booking.status === "PENDING_PAYMENT"
                                          ? "bg-purple-600 text-white"
                                          : "bg-gray-600 text-white"
                          }`}
                        >
                          {getStatusText(booking.status)}
                        </span>
                      </td>
                      {tab === "partner" && (
                        <td className="py-4 px-6 text-white font-medium">
                          {booking.partnerResponseDeadline ? (() => {
                            const deadline = new Date(booking.partnerResponseDeadline);
                            const now = new Date();
                            const diffMs = deadline.getTime() - now.getTime();
                            
                            // 格式化為「幾點幾分前」
                            const deadlineTime = deadline.toLocaleTimeString("zh-TW", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            });
                            
                            if (diffMs <= 0) {
                              return (
                                <span className="text-red-400 font-semibold">
                                  已過期 ({deadlineTime})
                                </span>
                              );
                            }
                            
                            return (
                              <span className="text-yellow-400 font-semibold">
                                {deadlineTime} 前
                              </span>
                            );
                          })() : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="py-4 px-6 text-white font-medium">
                        {booking.createdAt
                          ? new Date(booking.createdAt).toLocaleString(
                              "zh-TW",
                              {
                                timeZone: 'Asia/Taipei',
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )
                          : "-"}
                      </td>
                      {tab === "me" && (
                        <td className="py-4 px-6">
                          <div className="flex gap-2 items-center">
                            {booking.status !== "CANCELLED" && canCancel(booking) && (
                              <button
                                onClick={() => handleCancelBookingClick(booking.id)}
                                disabled={cancellingBooking === booking.id}
                                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {cancellingBooking === booking.id
                                  ? "取消中..."
                                  : "取消預約"}
                              </button>
                            )}
                            {booking.status === "REJECTED" &&
                              booking.rejectReason && (
                                <div className="relative">
                                  <button
                                    ref={(el) => {
                                      if (el) {
                                        buttonRefs.current.set(booking.id, el);
                                      } else {
                                        buttonRefs.current.delete(booking.id);
                                      }
                                    }}
                                    onMouseEnter={() => {
                                      if (
                                        typeof window !== "undefined" &&
                                        window.innerWidth >= 768
                                      ) {
                                        setHoveredRejectReason(booking.id);
                                      }
                                    }}
                                    onMouseLeave={() => {
                                      if (
                                        typeof window !== "undefined" &&
                                        window.innerWidth >= 768
                                      ) {
                                        setHoveredRejectReason(null);
                                      }
                                    }}
                                    onClick={() => {
                                      // 手機版：切換點擊狀態
                                      if (
                                        typeof window !== "undefined" &&
                                        window.innerWidth < 768
                                      ) {
                                        setClickedRejectReason(
                                          clickedRejectReason === booking.id
                                            ? null
                                            : booking.id,
                                        );
                                      }
                                    }}
                                    className="px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700 transition-colors"
                                  >
                                    查看原因
                                  </button>
                                  {/* 懸浮視窗 - 電腦版懸停顯示，手機版點擊顯示 */}
                                  {(hoveredRejectReason === booking.id ||
                                    clickedRejectReason === booking.id) &&
                                    popupPosition && (
                                      <div
                                        className="fixed z-[9999] bg-gray-800 text-white text-sm rounded-lg p-4 shadow-2xl border border-gray-700"
                                        style={{
                                          whiteSpace: "pre-wrap",
                                          wordWrap: "break-word",
                                          minWidth: "250px",
                                          maxWidth:
                                            typeof window !== "undefined" &&
                                            window.innerWidth < 768
                                              ? "calc(100vw - 2rem)"
                                              : "400px",
                                          width: "max-content",
                                          maxHeight:
                                            typeof window !== "undefined" &&
                                            window.innerWidth < 768
                                              ? "80vh"
                                              : "70vh",
                                          overflowY: "auto",
                                          ...(typeof window !== "undefined" &&
                                          window.innerWidth < 768
                                            ? {
                                                top: `${popupPosition.top}px`,
                                                left: `${popupPosition.left}px`,
                                                transform:
                                                  "translate(-50%, -50%)",
                                              }
                                            : {
                                                ...(popupPosition.top !==
                                                undefined
                                                  ? {
                                                      top: `${popupPosition.top}px`,
                                                    }
                                                  : {}),
                                                ...(popupPosition.bottom !==
                                                undefined
                                                  ? {
                                                      bottom: `${popupPosition.bottom}px`,
                                                    }
                                                  : {}),
                                                ...(popupPosition.left !==
                                                undefined
                                                  ? {
                                                      left: `${popupPosition.left}px`,
                                                    }
                                                  : {}),
                                                ...(popupPosition.right !==
                                                undefined
                                                  ? {
                                                      right: `${popupPosition.right}px`,
                                                    }
                                                  : {}),
                                              }),
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        onMouseEnter={() => {
                                          // 桌面版：保持懸停時顯示
                                          if (
                                            typeof window !== "undefined" &&
                                            window.innerWidth >= 768
                                          ) {
                                            setHoveredRejectReason(booking.id);
                                          }
                                        }}
                                        onMouseLeave={() => {
                                          // 桌面版：離開視窗時隱藏
                                          if (
                                            typeof window !== "undefined" &&
                                            window.innerWidth >= 768
                                          ) {
                                            setHoveredRejectReason(null);
                                          }
                                        }}
                                      >
                                        <div className="font-semibold mb-2 text-orange-400">
                                          拒絕原因：
                                        </div>
                                        <div className="text-gray-200 break-words">
                                          {booking.rejectReason}
                                        </div>
                                        {/* 手機版：關閉按鈕 */}
                                        {typeof window !== "undefined" &&
                                          window.innerWidth < 768 && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setClickedRejectReason(null);
                                              }}
                                              className="mt-3 w-full text-center text-xs text-gray-400 hover:text-white underline"
                                            >
                                              關閉
                                            </button>
                                          )}
                                      </div>
                                    )}
                                </div>
                              )}
                          </div>
                        </td>
                      )}
                      {tab === "partner" && (
                        <td className="py-4 px-6">
                          {booking.status !== "CANCELLED" &&
                            booking.status !== "REJECTED" &&
                            booking.status !== "COMPLETED" &&
                            (booking.status === "PAID_WAITING_PARTNER_CONFIRMATION" ||
                             booking.status === "PARTNER_ACCEPTED" ||
                             booking.status === "PENDING") && (
                            <div className="flex gap-2">
                              <button
                                disabled={
                                  loading || cancellingBooking === booking.id
                                }
                                className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={async () => {
                                  if (
                                    loading ||
                                    cancellingBooking === booking.id
                                  )
                                    return;
                                  if (!confirm("確定要接受這個預約嗎？"))
                                    return;

                                  setCancellingBooking(booking.id);
                                  try {
                                    const res = await fetch(
                                      `/api/bookings/${booking.id}/respond`,
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          action: "accept",
                                        }),
                                      },
                                    );
                                    const data = await res.json();
                                    if (res.ok) {
                                      alert("已接受預約！");
                                      // 樂觀更新：立即更新本地狀態，然後在背景重新載入
                                      setBookings((prev) =>
                                        prev.map((b) =>
                                          b.id === booking.id
                                            ? { ...b, status: "CONFIRMED" }
                                            : b,
                                        ),
                                      );
                                      // 在背景重新載入數據（不阻塞 UI）
                                      fetch("/api/bookings/partner", {
                                        cache: "no-store",
                                      })
                                        .then((res) => res.json())
                                        .then((data) => {
                                          if (
                                            data &&
                                            Array.isArray(data.bookings)
                                          ) {
                                            setBookings(data.bookings);
                                          }
                                        })
                                        .catch((err) =>
                                          console.error("背景更新失敗:", err),
                                        );
                                    } else {
                                      alert(data.error || "接受預約失敗");
                                    }
                                  } catch (error) {
                                    console.error("接受預約失敗:", error);
                                    alert("接受預約失敗，請重試");
                                  } finally {
                                    setCancellingBooking(null);
                                  }
                                }}
                              >
                                {cancellingBooking === booking.id
                                  ? "處理中..."
                                  : "接受"}
                              </button>
                              <button
                                disabled={
                                  loading || cancellingBooking === booking.id
                                }
                                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={async () => {
                                  if (
                                    loading ||
                                    cancellingBooking === booking.id
                                  )
                                    return;
                                  if (!confirm("確定要拒絕這個預約嗎？"))
                                    return;

                                  // 彈出輸入拒絕原因的對話框
                                  const reason =
                                    prompt("請輸入拒絕原因（必填）：");
                                  if (!reason || reason.trim() === "") {
                                    alert("必須輸入拒絕原因才能拒絕預約");
                                    return;
                                  }

                                  setCancellingBooking(booking.id);
                                  try {
                                    const res = await fetch(
                                      `/api/bookings/${booking.id}/respond`,
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          action: "reject",
                                          reason: reason.trim(),
                                        }),
                                      },
                                    );
                                    const data = await res.json();
                                    if (res.ok) {
                                      alert("已拒絕預約");
                                      // 樂觀更新：立即從列表中移除
                                      setBookings((prev) =>
                                        prev.filter((b) => b.id !== booking.id),
                                      );
                                      // 在背景重新載入數據（不阻塞 UI）
                                      fetch("/api/bookings/partner", {
                                        cache: "no-store",
                                      })
                                        .then((res) => res.json())
                                        .then((data) => {
                                          if (
                                            data &&
                                            Array.isArray(data.bookings)
                                          ) {
                                            setBookings(data.bookings);
                                          }
                                        })
                                        .catch((err) =>
                                          console.error("背景更新失敗:", err),
                                        );
                                    } else {
                                      alert(data.error || "拒絕預約失敗");
                                    }
                                  } catch (error) {
                                    console.error("拒絕預約失敗:", error);
                                    alert("拒絕預約失敗，請重試");
                                  } finally {
                                    setCancellingBooking(null);
                                  }
                                }}
                              >
                                {cancellingBooking === booking.id
                                  ? "處理中..."
                                  : "拒絕"}
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* 分頁按鈕 */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                  <button
                    className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    上一頁
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i + 1}
                      className={`px-3 py-1 rounded ${currentPage === i + 1 ? "bg-indigo-600 text-white" : "bg-gray-700 text-gray-300"}`}
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    下一頁
                  </button>
                </div>
              )}
            </div>
          )}
          {/* 統計資訊 */}
          {bookings.length > 0 && (
            <div className="mt-6 text-center text-gray-600 text-sm">
              共找到 {bookings.length} 筆{tab === "me" ? "預約" : "訂單"}記錄
            </div>
          )}
        </div>
      </InfoCard>

      {/* 取消預約理由 Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">取消預約</h2>
            <p className="text-gray-600 mb-4">
              請提供取消預約的理由。取消後無法復原。
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                取消理由 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="請說明取消預約的原因..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelBookingId(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCancelBooking}
                disabled={!cancelReason.trim() || cancellingBooking !== null}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancellingBooking ? "取消中..." : "確認取消"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PartnerPageLayout>
  );
}
