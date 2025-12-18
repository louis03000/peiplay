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

// 動態步驟顯示
const getSteps = (onlyAvailable: boolean) => {
  if (onlyAvailable) {
    return ["選擇夥伴", "選擇時長", "確認預約", "完成"];
  } else {
    return ["選擇夥伴", "選擇日期", "選擇時段", "確認預約", "完成"];
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
};

// 工具函式：判斷兩個日期是否同一天（本地時區）
function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function BookingWizardContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
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
  const [favoritePartnerIds, setFavoritePartnerIds] = useState<Set<string>>(
    new Set(),
  );
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [partnersError, setPartnersError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [partnerSchedules, setPartnerSchedules] = useState<Map<string, Partner['schedules']>>(new Map());
  const [loadingSchedules, setLoadingSchedules] = useState(false);

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
              const now = new Date();
              const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天後
              const url = `/api/partners/${partner.id}/schedules?startDate=${now.toISOString()}&endDate=${endDate.toISOString()}`;
              
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
  useEffect(() => {
    const fetchData = async (isRetry: boolean = false) => {
      if (!isRetry) {
        setLoading(true);
        setPartnersError(null);
      }

      try {
        // 構建 partners API URL（使用輕量級 API，不查時段）
        let partnersUrl = "/api/partners/list";
        const params = [];
        if (onlyAvailable) params.push("availableNow=true");
        if (onlyRankBooster) params.push("rankBooster=true");
        if (params.length > 0) partnersUrl += "?" + params.join("&");

        console.log('[預約頁面] 請求 URL:', partnersUrl);
        console.log('[預約頁面] 篩選條件:', { onlyAvailable, onlyRankBooster });

        // 並行請求：partners + favorites（如果已登入）
        // 對於「現在有空」不使用快取，確保即時性
        const requests: Promise<any>[] = [
          fetch(partnersUrl, {
            cache: onlyAvailable ? "no-store" : "force-cache", // 「現在有空」不使用快取
            headers: {
              "Cache-Control": onlyAvailable ? "no-cache, no-store, must-revalidate" : "max-age=30",
            },
          }).then(res => {
            console.log('[預約頁面] API 響應狀態:', res.status, res.ok);
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
          setPartners(partnersData);
          setPartnersError(null);
          setRetryCount(0);
        } else if (partnersData?.partners && Array.isArray(partnersData.partners)) {
          console.log('[預約頁面] 物件格式 {partners: []}，夥伴數量:', partnersData.partners.length);
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
  }, [onlyAvailable, onlyRankBooster, retryCount, sessionStatus, session]);

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
    const dateSet = new Set<string>();
    const now = new Date();
    schedules.forEach((s) => {
      if (!s.isAvailable) return;
      if (new Date(s.startTime) <= now) return;
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      dateSet.add(key);
    });
    return Array.from(dateSet)
      .map((key) => {
        const [year, month, date] = key.split("-").map(Number);
        return new Date(year, month, date).getTime();
      })
      .sort((a, b) => a - b);
  }, [selectedPartner, partnerSchedules]);

  // 優化時段選擇邏輯 - 過濾掉所有與已預約時段重疊的時段
  const availableTimeSlots = useMemo(() => {
    if (!selectedPartner || !selectedDate) {
      console.log('[預約頁面] availableTimeSlots: 缺少必要條件', { selectedPartner: !!selectedPartner, selectedDate: !!selectedDate });
      return [];
    }

    // 收集所有已預約的時段（排除已取消、已拒絕、已完成的）
    const bookedTimeSlots: Array<{ startTime: Date; endTime: Date }> = [];
    const now = new Date();

    // 遍歷所有時段，收集有效預約
    const schedules = partnerSchedules.get(selectedPartner.id) || [];
    console.log('[預約頁面] availableTimeSlots: 載入時段', { partnerId: selectedPartner.id, schedulesCount: schedules.length, selectedDate });
    schedules.forEach((schedule) => {
      // 只考慮同一天的時段
      const scheduleDate = new Date(schedule.date);
      if (!isSameDay(scheduleDate, selectedDate)) return;

      // 如果有預約且狀態有效，記錄其時間範圍
      if (schedule.bookings) {
        const bookingStatus = schedule.bookings.status;
        if (
          bookingStatus &&
          bookingStatus !== "CANCELLED" &&
          bookingStatus !== "REJECTED" &&
          bookingStatus !== "COMPLETED"
        ) {
          bookedTimeSlots.push({
            startTime: new Date(schedule.startTime),
            endTime: new Date(schedule.endTime),
          });
        }
      }
    });

    // 輔助函數：檢查兩個時間段是否有重疊
    const hasTimeOverlap = (
      start1: Date,
      end1: Date,
      start2: Date,
      end2: Date,
    ): boolean => {
      return (
        start1.getTime() < end2.getTime() && start2.getTime() < end1.getTime()
      );
    };

    const seenTimeSlots = new Set<string>();
    const uniqueSchedules = schedules.filter((schedule) => {
      // 基本檢查：時段必須可用
      if (!schedule.isAvailable) return false;

      const scheduleDate = new Date(schedule.date);
      if (!isSameDay(scheduleDate, selectedDate)) return false;
      if (new Date(schedule.startTime) <= now) return false;

      // 檢查是否與任何已預約時段重疊
      const scheduleStart = new Date(schedule.startTime);
      const scheduleEnd = new Date(schedule.endTime);

      for (const bookedSlot of bookedTimeSlots) {
        if (
          hasTimeOverlap(
            scheduleStart,
            scheduleEnd,
            bookedSlot.startTime,
            bookedSlot.endTime,
          )
        ) {
          return false; // 有重疊，排除這個時段
        }
      }

      // 如果有搜尋時段限制，檢查時段是否與搜尋時段重疊
      if (schedule.searchTimeRestriction) {
        const restriction = schedule.searchTimeRestriction;
        const searchStart = new Date(restriction.startTime);
        const searchEnd = new Date(restriction.endTime);

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
    const sorted = uniqueSchedules.sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    console.log('[預約頁面] availableTimeSlots 最終結果:', sorted.length, '個可用時段');
    return sorted;
  }, [selectedPartner, selectedDate, partnerSchedules]);

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
        // 移除金幣餘額更新
        setStep(onlyAvailable ? 3 : 4); // 跳到完成步驟
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
          throw new Error(errorData.error || "預約創建失敗");
        }

        const data = await response.json();
        setCreatedBooking(data);
        setStep(4); // 跳到完成步驟
      }
    } catch (error) {
      console.error("預約創建失敗:", error);
      alert(error instanceof Error ? error.message : "預約創建失敗，請重試");
    } finally {
      setCreating(false);
    }
  };

  // 載入夥伴時段
  const loadPartnerSchedules = useCallback(async (partnerId: string) => {
    // 如果已經載入過，直接返回
    if (partnerSchedules.has(partnerId)) {
      console.log('[預約頁面] 時段已載入，跳過:', partnerId);
      return;
    }

    console.log('[預約頁面] 開始載入夥伴時段:', partnerId);
    setLoadingSchedules(true);
    try {
      const now = new Date();
      const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天後
      const url = `/api/partners/${partnerId}/schedules?startDate=${now.toISOString()}&endDate=${endDate.toISOString()}`;
      
      console.log('[預約頁面] 時段 API URL:', url);
      const res = await fetch(url, {
        cache: "force-cache",
        headers: {
          "Cache-Control": "max-age=30",
        },
      });

      console.log('[預約頁面] 時段 API 響應狀態:', res.status, res.ok);
      if (res.ok) {
        const data = await res.json();
        console.log('[預約頁面] 時段 API 返回數據:', data);
        console.log('[預約頁面] 時段數量:', data.schedules?.length || 0);
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
      
      if (onlyAvailable) {
        setStep(1); // 直接跳到選擇時長步驟
      }
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
                    {filteredPartners.map((p) => (
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
                          />
                        </div>
                      </div>
                    ))}
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
                {[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((duration) => (
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
                    {duration === 0.5
                      ? "30分鐘"
                      : duration === 1
                        ? "1小時"
                        : `${duration}小時`}
                  </button>
                ))}
              </div>
              <div className="mt-4 text-center text-sm text-gray-900 font-medium">
                費用：$
                {(
                  selectedDuration *
                  selectedPartner.halfHourlyRate *
                  2
                ).toFixed(0)}{" "}
                (${selectedPartner.halfHourlyRate}/半小時)
              </div>
            </div>
          )}
          {!onlyAvailable && step === 2 && selectedPartner && selectedDate && (
            <div>
              <div className="text-lg text-white/90 mb-4 text-center">
                （3）選擇時段
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {availableTimeSlots.length === 0 ? (
                  <div className="text-gray-600 text-center py-8">
                    該日期沒有可預約的時段
                  </div>
                ) : (
                  availableTimeSlots.map((schedule) => {
                    const startTime = new Date(
                      schedule.startTime,
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const endTime = new Date(
                      schedule.endTime,
                    ).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const isSelected = selectedTimes.includes(schedule.id);
                    return (
                      <button
                        key={schedule.id}
                        onClick={() => handleTimeSelect(schedule.id)}
                        disabled={loading}
                        className={`px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium
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
                        {startTime} - {endTime}
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
                          {selectedDuration === 0.5
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
                          ? (
                              selectedDuration *
                              selectedPartner.halfHourlyRate *
                              2
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
          {/* 付款步驟暫時移除
        {((onlyAvailable && step === 3) || (!onlyAvailable && step === 4)) && (
          <div className="text-center">
            <div className="text-lg text-white/90 mb-4 text-center">（5）付款</div>
            <div className="text-6xl mb-4">💳</div>
            <p className="text-gray-600 mb-4">請在新視窗中完成付款</p>
            <div className="bg-yellow-900/30 border border-yellow-500 rounded-lg p-4 mt-4">
              <p className="text-yellow-300 text-sm">
                ⚠️ 重要：請在新開啟的付款頁面中完成付款，付款完成後預約才會生效。
              </p>
            </div>
            <div className="mt-4">
              <button
                onClick={() => setStep(onlyAvailable ? 2 : 3)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                回到確認頁面
              </button>
            </div>
          </div>
        )}
        */}
          {((onlyAvailable && step === 3) ||
            (!onlyAvailable && step === 4)) && (
            <div className="text-center">
              <div className="text-lg text-white/90 mb-4 text-center">
                （4）完成
              </div>
              <div className="text-6xl mb-4">✅</div>
              <p className="text-gray-600 mb-4">
                預約已確認，等待夥伴確認即可。
              </p>
              <div className="bg-green-900/30 border border-green-500 rounded-lg p-4 mt-4">
                <p className="text-green-300 text-sm">
                  🎉 恭喜！您的預約已成功建立。
                </p>
                {onlyAvailable && (
                  <p className="text-blue-300 text-sm mt-2">
                    ⏰ 即時預約：Discord 頻道將在夥伴確認後 3 分鐘自動開啟
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 導航按鈕 */}
        {((onlyAvailable && step < 2) || (!onlyAvailable && step < 3)) && (
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
