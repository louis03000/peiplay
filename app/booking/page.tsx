"use client";
export const dynamic = "force-dynamic";

import React from "react";
import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from "react";
import Image from "next/image";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import PartnerCard from "@/components/PartnerCard";
import SecureImage from "@/components/SecureImage";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import PartnerPageLayout from "@/components/partner/PartnerPageLayout";
import InfoCard from "@/components/partner/InfoCard";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(timezone);
dayjs.extend(utc);

// 動態步驟顯示
const getSteps = (onlyAvailable: boolean) => {
  if (onlyAvailable) {
    return ["選擇夥伴", "選擇時長", "確認預約", "付款", "完成"];
  } else {
    return ["選擇夥伴", "選擇日期", "選擇時段", "確認預約", "付款", "完成"];
  }
};

export type Partner = {
  id: string;
  name: string;
  games: string[];
  halfHourlyRate: number;
  coverImage?: string;
  images?: string[]; // 新增多張圖片支援
  supportsChatOnly?: boolean; // 新增純聊天支援
  chatOnlyRate?: number; // 新增純聊天收費
  schedules: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
    bookings?: { status: string } | null;
    searchTimeRestriction?: {
      startTime: string;
      endTime: string;
      startDate: string;
      endDate: string;
    };
  }[];
  isAvailableNow: boolean;
  isRankBooster: boolean;
  customerMessage?: string;
  averageRating?: number;
  totalReviews?: number;
  gender?: string | null;
  interests?: string[];
};

// 工具函式：判斷兩個日期是否同一天（本地時區）
function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * 判斷兩個時間段是否有重疊
 * 重疊判斷標準：slot.startTime < booking.endTime AND slot.endTime > booking.startTime
 * 
 * @param slotStart 時段開始時間
 * @param slotEnd 時段結束時間
 * @param bookingStart 預約開始時間
 * @param bookingEnd 預約結束時間
 * @returns true 表示有重疊，false 表示無重疊
 */
function hasTimeOverlap(
  slotStart: Date | string,
  slotEnd: Date | string,
  bookingStart: Date | string,
  bookingEnd: Date | string
): boolean {
  const slotStartMs = new Date(slotStart).getTime();
  const slotEndMs = new Date(slotEnd).getTime();
  const bookingStartMs = new Date(bookingStart).getTime();
  const bookingEndMs = new Date(bookingEnd).getTime();
  
  // 重疊判斷標準：slot.startTime < booking.endTime AND slot.endTime > booking.startTime
  return slotStartMs < bookingEndMs && slotEndMs > bookingStartMs;
}

/**
 * 判斷時段是否被占用
 * 採用「連續時間占用」模型：只要與任何預約時間有重疊，該時段就視為已被占用
 * 
 * 判斷標準：
 * - slot.startTime < booking.endTime AND slot.endTime > booking.startTime
 * 
 * @param slot 時段對象
 * @param activeBookings 所有活躍預約的時間範圍列表
 * @returns true 表示已被占用，false 表示未被占用
 */
function isSlotOccupied<T extends {
  startTime: string | Date;
  endTime: string | Date;
  bookings?: { status: string } | null;
}>(
  slot: T,
  activeBookings: Array<{ startTime: Date | string; endTime: Date | string }>
): boolean {
  // 檢查時段是否與任何活躍預約有重疊
  for (const booking of activeBookings) {
    if (hasTimeOverlap(slot.startTime, slot.endTime, booking.startTime, booking.endTime)) {
      return true; // 有重疊，時段已被占用
    }
  }
  
  return false; // 無重疊，時段未被占用
}

/**
 * 獲取可預約時段
 * 整合「過期 + 已被預約 + 重疊判斷」所有邏輯
 * 
 * booking 頁面只能顯示「可預約時段」
 * 以下任一條件成立，該時段就不可顯示、不可點選：
 * 1. 時段已過期
 * 2. 時段已被任何預約占用（採用連續時間占用模型，檢查重疊）
 * 
 * 過期時段判斷規則：
 * - 使用 slot.startTime 與 Date.now()（UTC timestamp）比較
 * - 若使用者選擇「今天」：new Date(slot.startTime).getTime() <= Date.now() → 不可顯示
 * - 若使用者選擇「未來日期」：不需用現在時間過濾
 * 
 * 占用判斷規則（連續時間占用模型）：
 * - 只要與任何預約時間有重疊，該時段就視為已被占用
 * - 重疊判斷標準：slot.startTime < booking.endTime AND slot.endTime > booking.startTime
 * - 與 /partner/schedule 頁面顯示邏輯保持一致
 * 
 * @param slots 時段列表（原始 schedules，包含已過期與未來時段）
 * @param selectedDate 用戶選擇的日期（本地時間）
 * @param activeBookings 所有活躍預約的時間範圍列表
 * @returns 過濾後的時段列表（只包含可預約時段）
 */
/**
 * 獲取可預約時段
 * 整合「過期 + 已被預約 + 重疊判斷」所有邏輯
 * 
 * 不論 API 的 startDate / endDate 為何，booking 頁面顯示前必須再做一次「向前過濾」
 * 
 * 過期判斷標準（唯一）：
 * - new Date(slot.startTime).getTime() <= Date.now()
 * - 所有符合上述條件的 slot 視為已過期，不可顯示，不可被預約
 * 
 * 占用判斷規則（連續時間占用模型）：
 * - 只要與任何預約時間有重疊，該時段就視為已被占用
 * - 重疊判斷標準：slot.startTime < booking.endTime AND slot.endTime > booking.startTime
 * - 與 /partner/schedule 頁面顯示邏輯保持一致
 * 
 * @param slots 時段列表（原始 schedules，包含已過期與未來時段）
 * @param selectedDate 用戶選擇的日期（本地時間，用於調試日誌）
 * @param activeBookings 所有活躍預約的時間範圍列表
 * @returns 過濾後的時段列表（只包含可預約時段）
 */
/**
 * 獲取可預約時段
 * 整合「過期 + 已被預約 + 重疊判斷」所有邏輯
 * 
 * Booking 頁面顯示條件（三條缺一不可）：
 * 1. slot.startTime > 現在時間（台灣時間）
 * 2. 該時段不是已被占用 / 已預約
 * 3. 該時段在 partner/schedule 中不是黃色格子
 * 
 * 過期判斷標準（唯一）：
 * - new Date(slot.startTime).getTime() <= Date.now()
 * - 所有符合上述條件的 slot 視為已過期，不可顯示，不可被預約
 * 
 * 占用判斷規則（連續時間占用模型）：
 * - 只要與任何預約時間有重疊，該時段就視為已被占用
 * - 重疊判斷標準：slot.startTime < booking.endTime AND slot.endTime > booking.startTime
 * 
 * @param slots 時段列表（原始 schedules，包含已過期與未來時段）
 * @param activeBookings 所有活躍預約的時間範圍列表
 * @returns 過濾後的時段列表（只包含可預約時段）
 */
function getBookableSlots<T extends { 
  startTime: string | Date;
  endTime: string | Date;
  bookings?: { status: string } | null;
}>(
  slots: T[],
  activeBookings: Array<{ startTime: Date | string; endTime: Date | string }>
): T[] {
  // 獲取當前時間（UTC timestamp）
  const nowTs = Date.now();
  
  // 調試日誌：過濾前
  console.log(`[預約頁面] getBookableSlots: 開始過濾`, {
    過濾前時段數量: slots.length,
    當前時間UTC: new Date(nowTs).toISOString(),
    活躍預約數: activeBookings.length
  });
  
  let occupiedCount = 0;
  
  const filtered = slots.filter((slot) => {
    // 注意：已過期時段過濾已在 availableTimeSlots 中根據 selectedDate 處理
    // 這裡只處理占用判斷
    
    // 檢查時段是否已被任何預約占用（採用連續時間占用模型）
    if (isSlotOccupied(slot, activeBookings)) {
      occupiedCount++;
      return false; // 已被占用，不可顯示
    }
    
    // 通過所有檢查，時段可預約
    return true;
  });
  
  // 調試日誌：過濾後
  const earliestSlot = filtered.length > 0 ? filtered[0] : null;
  const latestSlot = filtered.length > 0 ? filtered[filtered.length - 1] : null;
  
  console.log(`[預約頁面] getBookableSlots: 過濾結果`, {
    過濾前時段數量: slots.length,
    已被占用: occupiedCount,
    過濾後時段數量: filtered.length,
    最早時段: earliestSlot ? {
      id: (earliestSlot as any).id,
      台灣時間: new Date(earliestSlot.startTime).toLocaleString('zh-TW', { 
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } : null,
    最晚時段: latestSlot ? {
      id: (latestSlot as any).id,
      台灣時間: new Date(latestSlot.startTime).toLocaleString('zh-TW', { 
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    } : null
  });
  
  return filtered;
}

function BookingWizardContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  
  // 检查是否有支付结果参数（从 URL 跳转回来）
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success' || paymentStatus === 'failed') {
      // 如果是从支付页面跳转回来，显示完成步骤
      // 注意：实际支付完成应该跳转到 /booking/payment-success
    }
  }, [searchParams]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyRankBooster, setOnlyRankBooster] = useState(false);
  const [onlyChat, setOnlyChat] = useState(false);
  const [instantBooking, setInstantBooking] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number>(1); // 新增：預約時長（小時）
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [promoCode, setPromoCode] = useState("");
  const [promoCodeResult, setPromoCodeResult] = useState<any>(null);
  const [promoCodeError, setPromoCodeError] = useState("");
  const [isValidatingPromoCode, setIsValidatingPromoCode] = useState(false);
  const { data: session, status: sessionStatus } = useSession();
  // 移除金幣相關狀態
  const [creating, setCreating] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [paymentParams, setPaymentParams] = useState<any>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [favoritePartnerIds, setFavoritePartnerIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [partnersError, setPartnersError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [partnerSchedules, setPartnerSchedules] = useState<Map<string, Partner['schedules']>>(new Map());
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [timeRefreshKey, setTimeRefreshKey] = useState(0); // 用於定期觸發時段列表重新計算

  // 處理翻面功能
  const handleCardFlip = (partnerId: string) => {
    setFlippedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(partnerId)) {
        newSet.delete(partnerId);
      } else {
        newSet.add(partnerId);
      }
      return newSet;
    });
  };

  // 驗證優惠碼
  const validatePromoCode = async () => {
    if (!promoCode.trim() || !selectedPartner) return;

    setIsValidatingPromoCode(true);
    setPromoCodeError("");

    try {
      const originalAmount = onlyAvailable
        ? (selectedDuration * selectedPartner.halfHourlyRate * 2).toFixed(0)
        : selectedTimes.length * selectedPartner.halfHourlyRate;

      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoCode.trim(),
          amount: originalAmount,
          partnerId: selectedPartner.id,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setPromoCodeResult(data);
        setPromoCodeError("");
      } else {
        setPromoCodeError(data.error || "優惠碼驗證失敗");
        setPromoCodeResult(null);
      }
    } catch (error) {
      setPromoCodeError("優惠碼驗證失敗");
      setPromoCodeResult(null);
    } finally {
      setIsValidatingPromoCode(false);
    }
  };

  // 移除無用的金幣餘額獲取

  // 注意：favorites 現在在 fetchData 中並行載入，這裡不再需要單獨的 useEffect

  // 處理切換最愛
  const handleToggleFavorite = async (partnerId: string) => {
    if (!session?.user) {
      alert("請先登入");
      return;
    }

    const isFavorite = favoritePartnerIds.has(partnerId);
    const action = isFavorite ? "remove" : "add";

    // 樂觀更新 UI
    setFavoritePartnerIds((prev) => {
      const newSet = new Set(prev);
      if (action === "add") {
        newSet.add(partnerId);
      } else {
        newSet.delete(partnerId);
      }
      return newSet;
    });

    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId, action }),
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        console.log("✅ 最愛操作成功:", action, partnerId, data);
        // 確保狀態與伺服器同步
        setFavoritePartnerIds((prev) => {
          const newSet = new Set(prev);
          if (data.isFavorite) {
            newSet.add(partnerId);
          } else {
            newSet.delete(partnerId);
          }
          return newSet;
        });
      } else {
        // 如果失敗，恢復原狀態
        setFavoritePartnerIds((prev) => {
          const newSet = new Set(prev);
          if (action === "add") {
            newSet.delete(partnerId);
          } else {
            newSet.add(partnerId);
          }
          return newSet;
        });
        const errorData = await res.json();
        console.error("❌ 最愛操作失敗:", errorData);
        alert(errorData.error || "操作失敗");
      }
    } catch (error) {
      // 如果失敗，恢復原狀態
      setFavoritePartnerIds((prev) => {
        const newSet = new Set(prev);
        if (action === "add") {
          newSet.delete(partnerId);
        } else {
          newSet.add(partnerId);
        }
        return newSet;
      });
      console.error("Failed to toggle favorite:", error);
      alert("操作失敗，請重試");
    }
  };

  // 處理 URL 參數
  useEffect(() => {
    const partnerId = searchParams.get("partnerId");
    if (partnerId && partners.length > 0) {
      const partner = partners.find((p) => p.id === partnerId);
      if (partner) {
        setSelectedPartner(partner);
        setSelectedDate(null);
        setSelectedTimes([]);
        setSelectedDuration(1);
        
        // 載入時段（如果還沒有載入）
        if (!onlyAvailable && !partnerSchedules.has(partner.id)) {
          const loadSchedules = async () => {
            setLoadingSchedules(true);
            try {
              // 查詢未來 7 天的時段（前端會過濾已過期和已被預約的）
              // 🔥 使用台灣時區計算今天的開始時間，確保凌晨時段也能正確顯示
              const nowTaipei = dayjs().tz('Asia/Taipei');
              const todayStartTaipei = nowTaipei.startOf('day'); // 今天 00:00:00 台灣時間
              const endDateTaipei = todayStartTaipei.add(7, 'day'); // 7天後
              const url = `/api/partners/${partner.id}/schedules?startDate=${todayStartTaipei.toISOString()}&endDate=${endDateTaipei.toISOString()}`;
              
              const res = await fetch(url, {
                cache: "force-cache",
                headers: {
                  "Cache-Control": "max-age=30",
                },
              });

              if (res.ok) {
                const data = await res.json();
                setPartnerSchedules(prev => {
                  const newMap = new Map(prev);
                  newMap.set(partner.id, data.schedules || []);
                  return newMap;
                });
              }
            } catch (error) {
              console.error("[預約頁面] Failed to load schedules:", error);
            } finally {
              setLoadingSchedules(false);
            }
          };
          loadSchedules();
        }
        
        setStep(1); // 直接跳到選擇日期步驟
      }
    }
  }, [searchParams, partners, onlyAvailable, partnerSchedules]);

  // 優化：使用輕量級 API + 並行請求
  // 使用 useRef 保存最新的篩選條件，供定期刷新使用
  const filtersRef = useRef({ onlyAvailable, onlyRankBooster });
  useEffect(() => {
    filtersRef.current = { onlyAvailable, onlyRankBooster };
  }, [onlyAvailable, onlyRankBooster]);

  useEffect(() => {
    const fetchData = async (isRetry: boolean = false) => {
      if (!isRetry) {
        setLoading(true);
        setPartnersError(null);
      }

      try {
        // 構建 partners API URL（使用輕量級 API，不查時段）
        // 使用 filtersRef.current 確保定期刷新時使用最新的篩選條件
        const currentFilters = filtersRef.current;
        let partnersUrl = "/api/partners/list";
        const params = [];
        if (currentFilters.onlyAvailable) params.push("availableNow=true");
        if (currentFilters.onlyRankBooster) params.push("rankBooster=true");
        if (params.length > 0) partnersUrl += "?" + params.join("&");

        console.log('[預約頁面] 請求 URL:', partnersUrl);
        console.log('[預約頁面] 篩選條件:', currentFilters);

        // 並行請求：partners + favorites（如果已登入）
        // 為了顯示「現在有空」和「上分高手」標籤，總是獲取最新數據（不使用強制緩存）
        const requests: Promise<any>[] = [
          fetch(partnersUrl, {
            cache: "no-store", // 總是獲取最新數據，確保標籤正確顯示
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
            },
          }).then(res => {
            console.log('[預約頁面] API 響應狀態:', res.status, res.ok);
            if (!res.ok) {
              throw new Error(`API 請求失敗: ${res.status}`);
            }
            return res.json();
          }),
        ];

        // 如果已登入，同時請求 favorites
        if (sessionStatus === "authenticated" && session?.user) {
          requests.push(
            fetch("/api/favorites", {
              cache: "force-cache",
              headers: {
                "Cache-Control": "max-age=30",
              },
            }).then(res => res.json())
          );
        }

        // 並行執行所有請求
        const results = await Promise.all(requests);
        const partnersData = results[0];
        const favoritesData = results[1];

        // 調試：記錄 API 返回的數據
        console.log('[預約頁面] API 返回的 partnersData:', partnersData);
        console.log('[預約頁面] partnersData 類型:', typeof partnersData, Array.isArray(partnersData));

        // 處理 partners 資料
        if (Array.isArray(partnersData)) {
          console.log('[預約頁面] 直接數組格式，夥伴數量:', partnersData.length);
          // 檢查 isAvailableNow 和 isRankBooster 欄位
          const withAvailableNow = partnersData.filter(p => p.isAvailableNow);
          const withRankBooster = partnersData.filter(p => p.isRankBooster);
          console.log('[預約頁面] 有「現在有空」的夥伴數量:', withAvailableNow.length);
          console.log('[預約頁面] 有「上分高手」的夥伴數量:', withRankBooster.length);
          
          // 詳細記錄每個夥伴的狀態
          partnersData.forEach((p: Partner) => {
            if (p.isAvailableNow || p.isRankBooster) {
              console.log('[預約頁面] 夥伴狀態:', p.name, {
                isAvailableNow: p.isAvailableNow,
                isRankBooster: p.isRankBooster
              });
            }
          });
          
          setPartners(partnersData);
          setPartnersError(null);
          setRetryCount(0);
        } else if (partnersData?.partners && Array.isArray(partnersData.partners)) {
          console.log('[預約頁面] 物件格式 {partners: []}，夥伴數量:', partnersData.partners.length);
          // 檢查 isAvailableNow 和 isRankBooster 欄位
          const withAvailableNow = partnersData.partners.filter((p: Partner) => p.isAvailableNow);
          const withRankBooster = partnersData.partners.filter((p: Partner) => p.isRankBooster);
          console.log('[預約頁面] 有「現在有空」的夥伴數量:', withAvailableNow.length);
          console.log('[預約頁面] 有「上分高手」的夥伴數量:', withRankBooster.length);
          
          // 詳細記錄每個夥伴的狀態
          partnersData.partners.forEach((p: Partner) => {
            if (p.isAvailableNow || p.isRankBooster) {
              console.log('[預約頁面] 夥伴狀態:', p.name, {
                isAvailableNow: p.isAvailableNow,
                isRankBooster: p.isRankBooster
              });
            }
          });
          
          setPartners(partnersData.partners);
          setPartnersError(null);
          setRetryCount(0);
        } else {
          console.warn('[預約頁面] ⚠️ 無法識別的數據格式:', partnersData);
          setPartners([]);
          setPartnersError(null);
        }

        // 處理 favorites 資料
        if (favoritesData?.favorites) {
          const favoriteIds = new Set<string>(
            favoritesData.favorites.map((f: { partnerId: string }) => f.partnerId)
          );
          setFavoritePartnerIds(favoriteIds);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setPartnersError("網路錯誤，請檢查網路連線後重試");
        setPartners([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // 定期刷新數據，確保「現在有空」和「上分高手」標籤能即時顯示
    // 每 10 秒刷新一次，這樣用戶開啟「現在有空」後，最多等待 10 秒就能看到更新
    const refreshInterval = setInterval(() => {
      console.log('[預約頁面] 定期刷新數據...');
      fetchData(true); // 使用 isRetry=true 避免顯示 loading 狀態
    }, 10000); // 10 秒刷新一次
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [onlyAvailable, onlyRankBooster, retryCount, sessionStatus, session]);

  // 定期更新時段列表，過濾掉已過期的時段（每30秒更新一次，確保及時過濾已過期時段）
  useEffect(() => {
    if (!selectedPartner || !selectedDate) return;
    
    const interval = setInterval(() => {
      setTimeRefreshKey(prev => prev + 1);
    }, 30000); // 每30秒更新一次，確保及時過濾已過期時段
    
    return () => clearInterval(interval);
  }, [selectedPartner, selectedDate]);

  // 手動重試函數
  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  // 搜尋過濾 - 使用 useMemo 優化，使用防抖搜尋，並將收藏的夥伴放在最上面
  const filteredPartners: Partner[] = useMemo(() => {
    console.log('[預約頁面] 過濾前夥伴數量:', partners.length, '篩選條件:', { onlyAvailable, onlyRankBooster, onlyChat });
    const filtered = partners.filter((p) => {
      // 所有篩選條件都應該疊加（AND 邏輯）
      // 純聊天篩選：檢查 supportsChatOnly 欄位或 games 陣列中是否包含 'chat' 或 '純聊天'
      if (onlyChat) {
        const hasChatOnly = p.supportsChatOnly === true;
        const hasChatInGames = p.games?.some(game => 
          game.toLowerCase() === 'chat' || 
          game === '純聊天' || 
          game.toLowerCase().includes('chat')
        );
        if (!hasChatOnly && !hasChatInGames) return false;
      }
      
      // 現在有空篩選
      if (onlyAvailable && !p.isAvailableNow) return false;
      
      // 上分高手篩選
      if (onlyRankBooster && !p.isRankBooster) return false;

      // 所有條件都通過
      return true;
    });

    // 將收藏的夥伴放在最上面
    const sorted = filtered.sort((a, b) => {
      const aIsFavorite = favoritePartnerIds.has(a.id);
      const bIsFavorite = favoritePartnerIds.has(b.id);

      if (aIsFavorite && !bIsFavorite) return -1;
      if (!aIsFavorite && bIsFavorite) return 1;
      return 0;
    });
    console.log('[預約頁面] 過濾後夥伴數量:', sorted.length);
    return sorted;
  }, [partners, onlyAvailable, onlyRankBooster, onlyChat, favoritePartnerIds]);

  const handleTimeSelect = useCallback((timeId: string) => {
    setSelectedTimes((prev) =>
      prev.includes(timeId)
        ? prev.filter((t) => t !== timeId)
        : [...prev, timeId],
    );
  }, []);

  // 優化日期選擇邏輯（使用載入的時段）
  const availableDates = useMemo(() => {
    if (!selectedPartner) return [];
    const schedules = partnerSchedules.get(selectedPartner.id) || [];
    const dateSet = new Set<number>();
    const now = new Date();
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayKey = todayOnly.getTime();
    
    // 收集所有有未來時段的日期
    schedules.forEach((s) => {
      if (!s.isAvailable) return;
      
      // 使用 startTime 來確定日期（更準確，因為 startTime 包含完整的日期時間信息）
      const startTime = new Date(s.startTime);
      const scheduleDateOnly = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
      const dateKey = scheduleDateOnly.getTime();
      
      // 檢查這個時段是否在未來
      if (startTime > now) {
        dateSet.add(dateKey);
      }
    });
    
    // 特別處理今天：檢查今天是否有任何未來的時段
    // 使用 startTime 來判斷日期，而不是 s.date（因為可能有時區問題）
    const hasTodayFutureSlot = schedules.some((s) => {
      if (!s.isAvailable) return false;
      const startTime = new Date(s.startTime);
      const scheduleDateOnly = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate());
      // 檢查是否是今天
      if (scheduleDateOnly.getTime() !== todayKey) return false;
      // 檢查是否還有未來的時段
      return startTime > now;
    });
    
    // 如果今天有未來的時段，確保今天被加入
    if (hasTodayFutureSlot) {
      dateSet.add(todayKey);
    }
    
    return Array.from(dateSet).sort((a, b) => a - b);
  }, [selectedPartner, partnerSchedules]);

  // 優化時段選擇邏輯 - 過濾掉所有與已預約時段重疊的時段
  const availableTimeSlots = useMemo(() => {
    if (!selectedPartner || !selectedDate) {
      console.log('[預約頁面] availableTimeSlots: 缺少必要條件', { selectedPartner: !!selectedPartner, selectedDate: !!selectedDate });
      return [];
    }

    // 收集所有已預約的時段（排除已取消、已拒絕、已完成的）
    const bookedTimeSlots: Array<{ startTime: Date; endTime: Date }> = [];

    // 遍歷所有時段，收集有效預約
    const schedules = partnerSchedules.get(selectedPartner.id) || [];
    
    console.log('[預約頁面] availableTimeSlots: 載入時段', { 
      partnerId: selectedPartner.id, 
      過濾前時段數量: schedules.length, 
      選擇的日期: selectedDate.toLocaleDateString('zh-TW')
    });
    
    // 🔥 收集所有活躍預約的時間範圍（用於占用判斷）
    // 終止狀態：這些狀態的預約不會佔用時段
    const TERMINAL_STATUSES = ['CANCELLED', 'REJECTED', 'COMPLETED', 'PARTNER_REJECTED', 'COMPLETED_WITH_AMOUNT_MISMATCH'];
    
    // 使用 Set 來去重，避免同一個預約被多次記錄（當預約跨多個時段時）
    const bookedTimeSlotsSet = new Set<string>();
    
    // 🔥 收集所有活躍預約的時間範圍（用於占用判斷）
    // 注意：這裡收集的是所有活躍預約，不限於選中的日期
    // 因為占用判斷需要檢查所有預約，包括跨日期的預約
    schedules.forEach((schedule) => {
      // 如果有預約且狀態有效（非終止狀態），記錄其時間範圍
      // 注意：這裡記錄的是該時段直接關聯的預約
      // 但占用判斷會檢查所有活躍預約，包括跨時段的預約
      if (schedule.bookings) {
        const bookingStatus = schedule.bookings.status;
        if (
          bookingStatus &&
          !TERMINAL_STATUSES.includes(bookingStatus)
        ) {
          // 使用時間範圍作為唯一標識，避免重複記錄
          const timeRangeKey = `${schedule.startTime}-${schedule.endTime}`;
          if (!bookedTimeSlotsSet.has(timeRangeKey)) {
            bookedTimeSlotsSet.add(timeRangeKey);
            bookedTimeSlots.push({
              startTime: new Date(schedule.startTime),
              endTime: new Date(schedule.endTime),
            });
          }
        }
      }
    });

    const seenTimeSlots = new Set<string>();
    
    // 🔥 一、日期鎖定（第一層，最優先）
    // 使用者選擇 selectedDate（例如 2026/01/14）
    // 只保留 startTime 的「台灣日期」等於 selectedDate 的時段
    // 此步驟不得判斷是否過期，不得使用現在時間
    
    // 將 selectedDate 轉換為台灣時區的日期字串（YYYY-MM-DD）
    // 注意：selectedDate 是本地 Date 對象，需要轉換為台灣時區
    const selectedDateTW = dayjs(selectedDate).tz('Asia/Taipei').format('YYYY-MM-DD');
    
    // 先進行日期鎖定過濾
    const dateMatchedSchedules = schedules.filter((schedule) => {
      // 基本檢查：時段必須可用
      if (!schedule.isAvailable) return false;
      
      // 🔥 使用台灣時區判斷日期：將 startTime（UTC）轉換為台灣時區，提取日期
      // schedule.startTime 是 UTC 時間，需要轉換為台灣時區再比較日期
      const scheduleDateTW = dayjs(schedule.startTime).tz('Asia/Taipei').format('YYYY-MM-DD');
      
      // 只保留台灣日期等於 selectedDate 的時段
      if (scheduleDateTW !== selectedDateTW) {
        return false;
      }
      
      // 如果有搜尋時段限制，檢查時段是否與搜尋時段重疊
      if (schedule.searchTimeRestriction) {
        const restriction = schedule.searchTimeRestriction;
        const searchStart = new Date(restriction.startTime);
        const searchEnd = new Date(restriction.endTime);
        const scheduleStart = new Date(schedule.startTime);
        const scheduleEnd = new Date(schedule.endTime);

        // 檢查時段是否與搜尋時段重疊
        if (
          !hasTimeOverlap(scheduleStart, scheduleEnd, searchStart, searchEnd)
        ) {
          return false; // 與搜尋時段不重疊，排除
        }
      }

      // 去重：避免顯示相同的時段
      const timeSlotIdentifier = `${schedule.startTime}-${schedule.endTime}`;
      if (seenTimeSlots.has(timeSlotIdentifier)) {
        return false;
      }
      seenTimeSlots.add(timeSlotIdentifier);
      return true;
    });
    
    console.log('[預約頁面] 日期鎖定後:', {
      選擇的日期台灣: selectedDateTW,
      過濾前: schedules.length,
      日期匹配後: dateMatchedSchedules.length
    });
    
    // 🔥 二、過期判斷（僅限同一天）
    // 僅當 selectedDate === 今天（台灣日期）時：
    //   - 過濾掉 startTime <= 現在時間（台灣）
    // 若 selectedDate 不是今天：
    //   - 不做任何過期判斷
    
    // 獲取今天的台灣日期
    const todayTW = dayjs().tz('Asia/Taipei').format('YYYY-MM-DD');
    const isToday = selectedDateTW === todayTW;
    
    // 獲取現在的台灣時間（用於過期判斷）
    const nowTaipei = dayjs().tz('Asia/Taipei');
    const nowTs = nowTaipei.valueOf(); // 獲取 UTC timestamp
    
    let expiredFilteredCount = 0;
    const futureSchedules = dateMatchedSchedules.filter((schedule) => {
      // 如果選擇的不是今天，不做任何過期判斷
      if (!isToday) {
        return true; // 未來日期的所有時段都保留
      }
      
      // 只有選擇「今天」時，才過濾已過期時段（台灣時間）
      // 將 startTime（UTC）轉換為台灣時區進行比較
      const scheduleStartTaipei = dayjs(schedule.startTime).tz('Asia/Taipei');
      const scheduleStartTs = scheduleStartTaipei.valueOf();
      const isFuture = scheduleStartTs > nowTs;
      
      if (!isFuture) {
        expiredFilteredCount++;
        // 詳細日誌：記錄前幾個被過濾的已過期時段
        if (expiredFilteredCount <= 5) {
          console.log(`[預約頁面] ❌ 過濾已過期時段 (今天): ID=${schedule.id}, 時段開始時間(台灣)=${scheduleStartTaipei.format('YYYY-MM-DD HH:mm:ss')}, 現在時間(台灣)=${nowTaipei.format('YYYY-MM-DD HH:mm:ss')}, 時間差=${Math.round((nowTs - scheduleStartTs) / 1000 / 60)}分鐘`);
        }
      }
      
      return isFuture; // 只保留未來的時段（只有選擇今天時才過濾）
    });
    
    // 🔥 排序：按照開始時間排序（只排序未來的時段）
    const sorted = futureSchedules.sort((a, b) => {
      const timeA = new Date(a.startTime).getTime();
      const timeB = new Date(b.startTime).getTime();
      return timeA - timeB;
    });
    
    // 調試：檢查排序後的前幾個時段
    if (sorted.length > 0) {
      console.log('[預約頁面] 排序後的前3個時段:', sorted.slice(0, 3).map(s => ({
        id: s.id,
        開始時間UTC: new Date(s.startTime).toISOString(),
        開始時間台灣: new Date(s.startTime).toLocaleString('zh-TW', {
          timeZone: 'Asia/Taipei',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }),
        是否未來: new Date(s.startTime).getTime() > nowTs
      })));
    }
    
    console.log('[預約頁面] 過濾已過期時段後:', {
      選擇的日期台灣: selectedDateTW,
      是否今天: isToday,
      日期匹配後: dateMatchedSchedules.length,
      已過期被過濾: expiredFilteredCount,
      未來時段數: futureSchedules.length,
      排序後: sorted.length,
      當前時間台灣: nowTaipei.format('YYYY-MM-DD HH:mm:ss')
    });
    
    // 🔥 使用 getBookableSlots 過濾可預約時段
    // 整合「已被預約 + 重疊判斷」所有邏輯
    // 注意：已過期時段已在上面過濾，這裡只處理占用判斷
    // booking 頁面只能顯示「可預約時段」
    // 過濾條件：
    // 1. 時段已被任何預約占用（採用連續時間占用模型，檢查重疊）
    // 使用所有活躍預約的時間範圍進行占用判斷
    const bookableTimeSlots = getBookableSlots(sorted, bookedTimeSlots);
    
    // getBookableSlots 內部已經有詳細日誌輸出（包含過濾前後數量、最早最晚時段）
    console.log('[預約頁面] availableTimeSlots 最終結果:', {
      總時段數: schedules.length,
      日期匹配後: dateMatchedSchedules.length,
      過濾已過期後: futureSchedules.length,
      過濾占用後: bookableTimeSlots.length,
      最終顯示: bookableTimeSlots.length
    });
    
    return bookableTimeSlots;
  }, [selectedPartner, selectedDate, partnerSchedules, timeRefreshKey]);

  // 計算所需金幣
  const calculateRequiredCoins = () => {
    if (onlyAvailable && selectedDuration && selectedPartner?.halfHourlyRate) {
      return Math.ceil(selectedDuration * selectedPartner.halfHourlyRate * 2);
    } else if (selectedTimes.length > 0 && selectedPartner?.halfHourlyRate) {
      return Math.ceil(selectedTimes.length * selectedPartner.halfHourlyRate);
    }
    return 0;
  };

  const requiredCoins = calculateRequiredCoins();
  const hasEnoughCoins = true; // 暫時移除金幣檢查，直接設為 true

  // 修改確認預約函數
  const handleCreateBooking = async () => {
    // 暫時移除金幣檢查
    // if (!hasEnoughCoins) {
    //   alert(`金幣不足！需要 ${requiredCoins} 金幣，當前餘額 ${userCoins} 金幣`)
    //   return
    // }

    try {
      setCreating(true);

      if (onlyAvailable && selectedPartner) {
        // 即時預約
        const response = await fetch("/api/bookings/instant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partnerId: selectedPartner.id,
            duration: selectedDuration,
            isChatOnly: onlyChat || false, // 傳遞純聊天標誌
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          if (errorData.error === "金幣不足") {
            alert(
              `金幣不足！需要 ${errorData.required} 金幣，當前餘額 ${errorData.current} 金幣`,
            );
            return;
          }
          throw new Error(errorData.error || "預約創建失敗");
        }

        const data = await response.json();
        setCreatedBooking(data.booking);
        
        // 创建支付订单
        if (!selectedPartner) {
          throw new Error("缺少夥伴資訊");
        }
        const totalAmount = onlyChat && selectedPartner.chatOnlyRate
          ? selectedDuration * 60 * (selectedPartner.chatOnlyRate / 30)
          : selectedDuration * selectedPartner.halfHourlyRate * 2;
        
        const paymentResponse = await fetch("/api/payment/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: data.booking.id,
            amount: totalAmount,
            description: `${selectedPartner.name} - ${selectedDuration === 1/6 ? "10分鐘" : selectedDuration === 0.5 ? "30分鐘" : selectedDuration === 1 ? "1小時" : `${selectedDuration}小時`}`,
            itemName: `PeiPlay 遊戲夥伴預約 - ${selectedPartner.name} - ${selectedDuration === 1/6 ? "10分鐘" : selectedDuration === 0.5 ? "30分鐘" : selectedDuration === 1 ? "1小時" : `${selectedDuration}小時`}`,
          }),
        });
        
        if (paymentResponse.ok) {
          const paymentData = await paymentResponse.json();
          setPaymentParams(paymentData);
          setStep(onlyAvailable ? 3 : 4); // 跳到付款步驟
        } else {
          throw new Error("創建支付訂單失敗");
        }
      } else {
        // 一般預約 - 需要先獲取 scheduleIds
        if (!selectedTimes || selectedTimes.length === 0) {
          alert("請先選擇預約時段");
          return;
        }

        // 獲取選中時段的 scheduleIds
        const scheduleIds = selectedTimes
          .map((time) => {
            // 從時間字串中提取 scheduleId
            // 格式: "scheduleId|startTime|endTime"
            return time.split("|")[0];
          })
          .filter((id) => id);

        if (scheduleIds.length === 0) {
          alert("無法獲取時段資訊，請重新選擇");
          return;
        }

        // 發送一般預約請求
        const response = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduleIds }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          
          // 如果是 409 衝突，刷新可選時段
          if (response.status === 409 && selectedPartner) {
            // 強制重新載入時段（清除快取）
            await loadPartnerSchedules(selectedPartner.id, true);
            alert(errorData.error || "時段已被預約，請重新選擇其他時段");
          } else {
            throw new Error(errorData.error || "預約創建失敗");
          }
          return;
        }

        const data = await response.json();
        // 一般预约返回的是数组，取第一个
        const booking = Array.isArray(data.bookings) ? data.bookings[0] : data;
        setCreatedBooking(booking);
        
        // 创建支付订单
        if (!selectedPartner) {
          throw new Error("缺少夥伴資訊");
        }
        const totalAmount = onlyChat && selectedPartner.chatOnlyRate
          ? selectedTimes.length * 30 * (selectedPartner.chatOnlyRate / 30)
          : selectedTimes.length * selectedPartner.halfHourlyRate;
        
        const paymentResponse = await fetch("/api/payment/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookingId: booking.id,
            amount: totalAmount,
            description: `${selectedPartner.name} - ${selectedTimes.length} 個時段`,
            itemName: `PeiPlay 遊戲夥伴預約 - ${selectedPartner.name} - ${selectedTimes.length} 個時段`,
          }),
        });
        
        if (paymentResponse.ok) {
          const paymentData = await paymentResponse.json();
          setPaymentParams(paymentData);
          setStep(4); // 跳到付款步驟
        } else {
          throw new Error("創建支付訂單失敗");
        }
      }
    } catch (error) {
      console.error("預約創建失敗:", error);
      alert(error instanceof Error ? error.message : "預約創建失敗，請重試");
    } finally {
      setCreating(false);
    }
  };

  // 載入夥伴時段
  const loadPartnerSchedules = useCallback(async (partnerId: string, forceRefresh: boolean = false) => {
    // 如果已經載入過且不是強制刷新，直接返回
    if (!forceRefresh && partnerSchedules.has(partnerId)) {
      console.log('[預約頁面] 時段已載入，跳過:', partnerId);
      return;
    }

    console.log('[預約頁面] 開始載入夥伴時段:', partnerId);
    setLoadingSchedules(true);
    try {
      // 查詢未來 7 天的時段（前端會過濾已過期和已被預約的）
      // 🔥 使用台灣時區計算今天的開始時間，確保凌晨時段也能正確顯示
      const nowTaipei = dayjs().tz('Asia/Taipei');
      const todayStartTaipei = nowTaipei.startOf('day'); // 今天 00:00:00 台灣時間
      const endDateTaipei = todayStartTaipei.add(7, 'day'); // 7天後
      const url = `/api/partners/${partnerId}/schedules?startDate=${todayStartTaipei.toISOString()}&endDate=${endDateTaipei.toISOString()}`;
      
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });

      console.log('[預約頁面] 時段 API 響應狀態:', res.status, res.ok);
      if (res.ok) {
        const data = await res.json();
        console.log('[預約頁面] 今天時段 API 返回:', {
          schedulesCount: data.schedules?.length || 0
        });
        setPartnerSchedules(prev => {
          const newMap = new Map(prev);
          newMap.set(partnerId, data.schedules || []);
          console.log('[預約頁面] 已更新 partnerSchedules，當前數量:', newMap.get(partnerId)?.length || 0);
          return newMap;
        });
      } else {
        const errorText = await res.text();
        console.error('[預約頁面] 時段 API 錯誤:', res.status, errorText);
      }
    } catch (error) {
      console.error("[預約頁面] Failed to load schedules:", error);
    } finally {
      setLoadingSchedules(false);
    }
  }, [partnerSchedules]);

  const handlePartnerSelect = useCallback(
    async (partner: Partner) => {
      setSelectedPartner(partner);
      setSelectedDate(null);
      setSelectedTimes([]);
      setSelectedDuration(1); // 重置預約時長
      
      // 載入時段（如果還沒有載入）
      if (!onlyAvailable) {
        await loadPartnerSchedules(partner.id);
      }
      
      // 移除自動跳轉邏輯，讓用戶必須點選「下一步」才能進入下一步驟
      // if (onlyAvailable) {
      //   setStep(1); // 直接跳到選擇時長步驟
      // }
    },
    [onlyAvailable, loadPartnerSchedules],
  );

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedTimes([]);
  }, []);

  const handleNextStep = useCallback(() => {
    setStep((prev) => prev + 1);
  }, []);

  const handlePrevStep = useCallback(() => {
    setStep((prev) => prev - 1);
  }, []);

  const canProceed = useMemo(() => {
    switch (step) {
      case 0:
        return selectedPartner !== null;
      case 1:
        return onlyAvailable ? selectedDuration > 0 : selectedDate !== null;
      case 2:
        return onlyAvailable ? true : selectedTimes.length > 0;
      default:
        return true;
    }
  }, [
    step,
    selectedPartner,
    selectedDate,
    selectedTimes,
    selectedDuration,
    onlyAvailable,
  ]);

  return (
    <PartnerPageLayout
      title="預約陪玩服務"
      subtitle="選擇專業夥伴，享受優質的遊戲陪玩體驗"
      maxWidth="6xl"
    >
      <InfoCard className="p-4 sm:p-8">
        {/* 步驟指示器 */}
        <div className="mb-16">
          <div className="flex items-center justify-between relative">
            <div
              className="absolute top-1/2 left-8 right-8 h-2 -z-10 rounded-full"
              style={{
                backgroundColor: "#E4E7EB",
              }}
            />
            {getSteps(onlyAvailable).map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center">
                <div
                  className={`w-16 h-16 flex items-center justify-center rounded-2xl border-2 transition-all duration-300 text-lg font-bold
                    ${
                      i < step
                        ? "shadow-lg"
                        : i === step
                          ? "shadow-xl scale-110"
                          : ""
                    }`}
                  style={{
                    background:
                      i <= step
                        ? "linear-gradient(135deg, #6C63FF 0%, #5a52e6 100%)"
                        : "white",
                    borderColor: i <= step ? "#6C63FF" : "#E4E7EB",
                    color: i <= step ? "white" : "#333140",
                  }}
                >
                  {i + 1}
                </div>
                <div
                  className={`mt-4 text-lg text-center font-medium ${i === step ? "font-bold" : ""}`}
                  style={{
                    color: i === step ? "#6C63FF" : "#333140",
                    opacity: i === step ? 1 : 0.7,
                  }}
                >
                  {s}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 步驟內容 */}
        <div className="min-h-[400px] transition-all duration-300">
          {step === 0 && (
            <div className="px-4 sm:px-10 pb-10">
              {/* 篩選器 - 等距排列 */}
              <div className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 w-full">
                  <label className="flex w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-white/80 px-4 py-2 text-gray-900 text-sm select-none cursor-pointer transition-colors hover:border-[#6C63FF]/40">
                    <input
                      id="only-available"
                      type="checkbox"
                      checked={onlyAvailable}
                      onChange={(e) => setOnlyAvailable(e.target.checked)}
                      className="accent-[#6C63FF] w-4 h-4 sm:w-5 sm:h-5"
                    />
                    <span className="text-xs sm:text-sm font-bold">只看現在有空</span>
                  </label>
                  <label className="flex w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-white/80 px-4 py-2 text-gray-900 text-sm select-none cursor-pointer transition-colors hover:border-[#6C63FF]/40">
                    <input
                      id="only-rank-booster"
                      type="checkbox"
                      checked={onlyRankBooster}
                      onChange={(e) => setOnlyRankBooster(e.target.checked)}
                      className="accent-[#6C63FF] w-4 h-4 sm:w-5 sm:h-5"
                    />
                    <span className="text-xs sm:text-sm font-bold">只看上分高手</span>
                  </label>
                  <label className="flex w-full items-center justify-center gap-2 rounded-2xl border border-transparent bg-white/80 px-4 py-2 text-gray-900 text-sm select-none cursor-pointer transition-colors hover:border-[#6C63FF]/40">
                    <input
                      id="only-chat"
                      type="checkbox"
                      checked={onlyChat}
                      onChange={(e) => setOnlyChat(e.target.checked)}
                      className="accent-green-500 w-4 h-4 sm:w-5 sm:h-5"
                    />
                    <span className="text-xs sm:text-sm font-bold">純聊天</span>
                  </label>
                </div>
              </div>

              {/* 現在有空提示信息 */}
              {onlyAvailable && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-sm text-yellow-800 font-medium">
                      訂單一經成立，將於 15 分鐘後開始提供服務；請確認並同意後再進行預約。
                    </p>
                  </div>
                </div>
              )}

              {/* 群組預約按鈕 */}
              <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-center items-center">
                <a
                  href="/booking/group"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#6C63FF] text-white rounded-2xl hover:bg-[#5a52e6] transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
                >
                  <span className="text-lg">🎮</span>
                  <span className="font-medium">群組預約</span>
                  <span className="text-sm opacity-90">與其他玩家一起預約</span>
                </a>
                <a
                  href="/booking/multi-player"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 font-medium"
                >
                  <span className="text-lg">👥</span>
                  <span className="font-medium">多人陪玩</span>
                  <span className="text-sm opacity-90">一次選擇多位夥伴</span>
                </a>
              </div>

              {/* 載入狀態 */}
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6C63FF] mb-4"></div>
                  <p className="text-gray-600 text-sm">載入夥伴資料中...</p>
                </div>
              ) : (
                <>
                  {/* 錯誤提示 */}
                  {partnersError && (
                    <div className="col-span-full mb-4">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-red-800 font-semibold mb-1">
                              載入夥伴資料失敗
                            </h3>
                            <p className="text-red-600 text-sm">
                              {partnersError}
                            </p>
                          </div>
                          <button
                            onClick={handleRetry}
                            className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                          >
                            重試
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 夥伴卡片網格 - 增加每行顯示數量，讓卡片更小更緊湊 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {!partnersError && filteredPartners.length === 0 && (
                      <div className="col-span-full text-gray-600 text-center py-8">
                        <div className="mb-4">
                          <div className="text-6xl mb-2">🔍</div>
                          <p className="text-lg font-medium mb-2">目前沒有可用的夥伴</p>
                          <p className="text-sm text-gray-500">請稍後再試或調整篩選條件</p>
                        </div>
                      </div>
                    )}
                    {filteredPartners.map((p) => {
                      // 調試：記錄夥伴的狀態
                      if (p.isAvailableNow || p.isRankBooster) {
                        console.log('[預約頁面] 夥伴狀態:', p.name, {
                          isAvailableNow: p.isAvailableNow,
                          isRankBooster: p.isRankBooster
                        });
                      }
                      return (
                        <div key={p.id} className="mb-4 relative group">
                          <div
                            className={`transition-all duration-200 rounded-2xl border-2 
                          ${
                            selectedPartner?.id === p.id
                              ? "border-transparent ring-4 ring-[#6C63FF]/60 ring-offset-2 shadow-2xl scale-105 bg-[#1e293b]/40"
                              : "border-transparent hover:ring-2 hover:ring-[#6C63FF]/40 hover:scale-102"
                          } 
                          cursor-pointer`}
                            style={{
                              boxShadow:
                                selectedPartner?.id === p.id
                                  ? "0 0 0 4px #818cf8, 0 8px 32px 0 rgba(55,48,163,0.15)"
                                  : undefined,
                              pointerEvents: loading ? "none" : "auto",
                              opacity: loading ? 0.6 : 1,
                            }}
                            onClick={() => {
                              if (loading) return; // 載入中時禁止點擊
                              handlePartnerSelect(p);
                            }}
                          >
                            <PartnerCard
                              partner={p}
                              flipped={flippedCards.has(p.id)}
                              onFlip={() => handleCardFlip(p.id)}
                              isFavorite={favoritePartnerIds.has(p.id)}
                              onToggleFavorite={handleToggleFavorite}
                              isChatOnlyFilter={onlyChat}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          {!onlyAvailable && step === 1 && selectedPartner && (
            <div>
              <div className="text-lg text-white/90 mb-4 text-center">
                （2）選擇日期
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {availableDates.map((ts) => {
                  const d = new Date(ts);
                  const label = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
                  const isSelected =
                    selectedDate && d.getTime() === selectedDate.getTime();
                  return (
                    <button
                      key={ts}
                      onClick={() => handleDateSelect(d)}
                      disabled={loading}
                      className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium
                        ${loading ? "opacity-50 cursor-not-allowed" : ""}
                        ${
                          isSelected ? "shadow-lg scale-105" : "hover:shadow-md"
                        }`}
                      style={{
                        backgroundColor: isSelected ? "#1A73E8" : "white",
                        color: isSelected ? "white" : "#333140",
                        borderColor: "#E4E7EB",
                        border: "1px solid #E4E7EB",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {onlyAvailable && step === 1 && selectedPartner && (
            <div>
              <div className="text-lg text-gray-900 font-bold mb-4">
                （2）選擇預約時長
              </div>
              <div className="text-sm text-gray-700 mb-6 text-center">
                選擇您想要預約的時長，系統會自動安排最適合的時間
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                {[1/6, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((duration) => (
                  <button
                    key={duration}
                    onClick={() => setSelectedDuration(duration)}
                    disabled={loading}
                    className={`px-4 py-3 border-2 border-black transition-all duration-200 text-sm font-medium
                    ${loading ? "opacity-50 cursor-not-allowed" : ""}
                    ${
                      selectedDuration === duration
                        ? "bg-black text-white shadow-lg scale-105"
                        : "bg-white text-black hover:bg-gray-100"
                    }`}
                    style={{
                      backgroundColor:
                        selectedDuration === duration ? "black" : "white",
                      color: selectedDuration === duration ? "white" : "black",
                      borderColor: "black",
                    }}
                  >
                    {duration === 1/6
                      ? "10分鐘"
                      : duration === 0.5
                        ? "30分鐘"
                        : duration === 1
                          ? "1小時"
                          : `${duration}小時`}
                  </button>
                ))}
              </div>
              <div className="mt-4 text-center text-sm text-gray-900 font-medium">
                費用：$
                {onlyChat && selectedPartner.chatOnlyRate
                  ? (
                      selectedDuration * 60 * (selectedPartner.chatOnlyRate / 30)
                    ).toFixed(0)
                  : (
                      selectedDuration *
                      selectedPartner.halfHourlyRate *
                      2
                    ).toFixed(0)}{" "}
                {onlyChat && selectedPartner.chatOnlyRate
                  ? `($${selectedPartner.chatOnlyRate}/30分鐘)`
                  : `($${selectedPartner.halfHourlyRate}/半小時)`}
              </div>
            </div>
          )}
          {!onlyAvailable && step === 2 && selectedPartner && selectedDate && (
            <div>
              <div className="text-lg text-white/90 mb-4 text-center">
                （3）選擇時段
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 max-h-[600px] overflow-y-auto">
                {availableTimeSlots.length === 0 ? (
                  <div className="col-span-3 sm:col-span-4 md:col-span-5 lg:col-span-7 text-gray-600 text-center py-8">
                    該日期沒有可預約的時段
                  </div>
                ) : (
                  availableTimeSlots
                    .filter((schedule) => {
                      // 🔥 最後一層防護：在 UI 渲染時再次過濾已過期時段（只有選擇今天時）
                      // 獲取今天的台灣日期
                      const todayTW = dayjs().tz('Asia/Taipei').format('YYYY-MM-DD');
                      const selectedDateTW = dayjs(selectedDate).tz('Asia/Taipei').format('YYYY-MM-DD');
                      const isToday = selectedDateTW === todayTW;
                      
                      // 如果選擇的是未來日期，不需要過濾已過期時段
                      if (!isToday) {
                        return true;
                      }
                      
                      // 只有選擇「今天」時，才過濾已過期時段（台灣時間）
                      const nowTaipei = dayjs().tz('Asia/Taipei');
                      const scheduleStartTaipei = dayjs(schedule.startTime).tz('Asia/Taipei');
                      const isFuture = scheduleStartTaipei.isAfter(nowTaipei);
                      
                      if (!isFuture) {
                        console.log(`[預約頁面] ⚠️ UI渲染時發現已過期時段，已過濾: ID=${schedule.id}, 開始時間(台灣)=${scheduleStartTaipei.format('YYYY-MM-DD HH:mm:ss')}`);
                      }
                      
                      return isFuture;
                    })
                    .map((schedule) => {
                    // 🔥 使用 dayjs 轉換為台灣時區顯示，確保顯示格式一致
                    const startTaipei = dayjs(schedule.startTime).tz('Asia/Taipei');
                    const endTaipei = dayjs(schedule.endTime).tz('Asia/Taipei');
                    
                    // 轉換為台灣時間顯示（12小時制，中文上午/下午）
                    const startHour = startTaipei.hour();
                    const endHour = endTaipei.hour();
                    const startPeriod = startHour < 12 ? '上午' : '下午';
                    const endPeriod = endHour < 12 ? '上午' : '下午';
                    const startTimeTW = `${startPeriod} ${startTaipei.format('hh:mm')}`;
                    const endTimeTW = `${endPeriod} ${endTaipei.format('hh:mm')}`;
                    
                    const isSelected = selectedTimes.includes(schedule.id);
                    return (
                      <button
                        key={schedule.id}
                        onClick={() => handleTimeSelect(schedule.id)}
                        disabled={loading}
                        className={`px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium
                        ${loading ? "opacity-50 cursor-not-allowed" : ""}
                        ${
                          isSelected ? "shadow-lg scale-105" : "hover:shadow-md"
                        }`}
                        style={{
                          backgroundColor: isSelected ? "#00BFA5" : "white",
                          color: isSelected ? "white" : "#333140",
                          borderColor: "#E4E7EB",
                          border: "1px solid #E4E7EB",
                        }}
                      >
                        {startTimeTW} - {endTimeTW}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
          {((onlyAvailable && step === 2) || (!onlyAvailable && step === 3)) &&
            selectedPartner && (
              <div>
                <div className="text-lg text-gray-900 mb-4 text-center">
                  （3）確認預約
                </div>
                <div className="bg-blue-50 rounded-lg p-6 mb-6 border border-blue-200">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden relative flex-shrink-0">
                      {selectedPartner.coverImage ? (
                        <SecureImage
                          src={selectedPartner.coverImage}
                          alt={selectedPartner.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600 font-bold text-xl">
                          {selectedPartner.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-gray-900 font-bold text-lg">
                        {selectedPartner.name}
                      </h3>
                      <p className="text-gray-700 text-sm">
                        {selectedPartner.games.join(", ")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {onlyAvailable ? (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-medium">
                          預約時長：
                        </span>
                        <span className="text-gray-900 font-bold">
                          {selectedDuration === 1/6
                            ? "10分鐘"
                            : selectedDuration === 0.5
                              ? "30分鐘"
                              : selectedDuration === 1
                                ? "1小時"
                                : `${selectedDuration}小時`}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-medium">
                          選擇日期：
                        </span>
                        <span className="text-gray-900 font-bold">
                          {selectedDate
                            ? `${selectedDate.getFullYear()}-${selectedDate.getMonth() + 1}-${selectedDate.getDate()}`
                            : "未選擇"}
                        </span>
                      </div>
                    )}

                    {!onlyAvailable && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-900 font-medium">
                          選擇時段：
                        </span>
                        <span className="text-gray-900 font-bold">
                          {selectedTimes.length} 個時段
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <span className="text-gray-900 font-medium">
                        總費用：
                      </span>
                      <span className="text-gray-900 font-bold text-lg">
                        $
                        {onlyAvailable
                          ? onlyChat && selectedPartner.chatOnlyRate
                            ? (
                                selectedDuration * 60 * (selectedPartner.chatOnlyRate / 30)
                              ).toFixed(0)
                            : (
                                selectedDuration *
                                selectedPartner.halfHourlyRate *
                                2
                              ).toFixed(0)
                          : onlyChat && selectedPartner.chatOnlyRate
                            ? (
                                selectedTimes.length * 30 * (selectedPartner.chatOnlyRate / 30)
                              ).toFixed(0)
                            : selectedTimes.length *
                              selectedPartner.halfHourlyRate}
                      </span>
                    </div>

                    {/* 優惠碼輸入 */}
                    <div className="border-t border-gray-600 pt-4 mt-4">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          placeholder="輸入優惠碼"
                          className="flex-1 px-4 py-2.5 bg-gray-700 text-white rounded-2xl border border-gray-600 focus:border-[#6C63FF] focus:outline-none focus:ring-2 focus:ring-[#6C63FF]"
                        />
                        <button
                          onClick={validatePromoCode}
                          disabled={!promoCode.trim() || isValidatingPromoCode}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isValidatingPromoCode ? "驗證中..." : "驗證"}
                        </button>
                      </div>

                      {promoCodeError && (
                        <p className="text-red-400 text-sm">{promoCodeError}</p>
                      )}

                      {promoCodeResult && (
                        <div className="bg-green-900/30 border border-green-500 rounded p-3">
                          <p className="text-green-400 text-sm font-medium">
                            ✅ 優惠碼已應用：{promoCodeResult.promoCode.code}
                          </p>
                          <p className="text-green-300 text-xs">
                            折扣：-${promoCodeResult.discountAmount}
                          </p>
                          <p className="text-white text-sm font-bold">
                            最終費用：${promoCodeResult.finalAmount}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-center">
                  <button
                    onClick={handlePrevStep}
                    className="px-8 py-3 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg"
                    style={{
                      backgroundColor: "white",
                      color: "#333140",
                      border: "2px solid #E4E7EB",
                    }}
                  >
                    上一步
                  </button>
                  <button
                    onClick={handleCreateBooking}
                    disabled={creating}
                    className="px-8 py-3 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: "#00BFA5",
                      color: "white",
                      boxShadow: "0 4px 20px rgba(0, 191, 165, 0.3)",
                    }}
                  >
                    {creating ? "處理中..." : "確認預約"}
                  </button>
                </div>
              </div>
            )}
          {/* 付款步驟 */}
          {((onlyAvailable && step === 3) || (!onlyAvailable && step === 4)) && paymentParams && (
            <div className="text-center">
              <div className="text-lg text-gray-900 font-bold mb-4 text-center">
                {onlyAvailable ? "（4）付款" : "（5）付款"}
              </div>
              <div className="text-6xl mb-4">💳</div>
              <p className="text-gray-700 mb-4 text-lg font-medium">
                請完成付款以確認預約
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4 mb-6">
                <p className="text-yellow-800 text-sm font-medium">
                  ⚠️ 重要：請在付款頁面中完成付款，付款完成後預約才會生效。
                </p>
              </div>
              
              {/* 支付表单 */}
              <form
                id="ecpay-form"
                method="POST"
                action={paymentParams.paymentUrl}
                className="mb-6"
                onSubmit={() => {
                  setIsProcessingPayment(true);
                }}
              >
                {Object.entries(paymentParams.paymentParams).map(([key, value]) => (
                  <input
                    key={key}
                    type="hidden"
                    name={key}
                    value={value as string}
                  />
                ))}
                <button
                  type="submit"
                  className="px-8 py-4 bg-[#00BFA5] text-white rounded-lg font-semibold text-lg transition-all duration-200 hover:shadow-lg cursor-pointer"
                  style={{
                    boxShadow: "0 4px 20px rgba(0, 191, 165, 0.3)",
                  }}
                >
                  前往付款
                </button>
              </form>
              
              <div className="mt-4">
                <button
                  onClick={() => setStep(onlyAvailable ? 2 : 3)}
                  className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  回到確認頁面
                </button>
              </div>
            </div>
          )}
          {((onlyAvailable && step === 4) ||
            (!onlyAvailable && step === 5)) && (
            <div className="text-center">
              <div className="text-lg text-white/90 mb-4 text-center">
                {onlyAvailable ? "（5）完成" : "（6）完成"}
              </div>
              <div className="text-6xl mb-4">✅</div>
              <p className="text-gray-600 mb-4">
                預約已確認，等待夥伴確認即可。
              </p>
              <div className="bg-green-100 border border-green-500 rounded-lg p-4 mt-4">
                <p className="text-gray-900 text-base font-semibold">
                  🎉 恭喜！您的預約已成功建立。
                </p>
                {onlyAvailable && (
                  <p className="text-gray-800 text-base font-semibold mt-2">
                    ⏰ 即時預約：Discord 頻道將在夥伴確認後 3 分鐘自動開啟
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 導航按鈕 */}
        {((onlyAvailable && step < 2) || (!onlyAvailable && step < 3)) && !paymentParams && (
          <div className="flex justify-between gap-6 mt-12">
            <button
              onClick={handlePrevStep}
              disabled={step === 0}
              className="px-10 py-4 rounded-2xl font-semibold transition-all duration-300 hover:shadow-xl hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                backgroundColor: "white",
                color: "#333140",
                border: "2px solid #E4E7EB",
                boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
              }}
            >
              上一步
            </button>
            <button
              onClick={handleNextStep}
              disabled={!canProceed}
              className="px-10 py-4 rounded-2xl font-semibold transition-all duration-300 hover:shadow-xl hover:scale-105 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: "linear-gradient(135deg, #6C63FF 0%, #5a52e6 100%)",
                color: "white",
                boxShadow: "0 8px 32px rgba(108, 99, 255, 0.3)",
              }}
            >
              下一步
            </button>
          </div>
        )}
      </InfoCard>
    </PartnerPageLayout>
  );
}

export default function BookingWizard() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6C63FF]"></div>
        </div>
      }
    >
      <BookingWizardContent />
    </Suspense>
  );
}
