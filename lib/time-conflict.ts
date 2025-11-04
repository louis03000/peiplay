/**
 * 時間衝突檢查工具函數
 */

/**
 * 檢查兩個時間段是否有重疊
 * @param start1 時間段1的開始時間
 * @param end1 時間段1的結束時間
 * @param start2 時間段2的開始時間
 * @param end2 時間段2的結束時間
 * @returns true 表示有重疊，false 表示沒有重疊
 */
export function hasTimeOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  // 時間段重疊的條件：start1 < end2 && start2 < end1
  return start1.getTime() < end2.getTime() && start2.getTime() < end1.getTime();
}

/**
 * 檢查時間段是否與現有預約衝突
 * @param partnerId 夥伴ID
 * @param startTime 新預約的開始時間
 * @param endTime 新預約的結束時間
 * @param excludeBookingId 要排除的預約ID（用於更新預約時）
 */
export async function checkTimeConflict(
  partnerId: string,
  startTime: Date,
  endTime: Date,
  excludeBookingId?: string
) {
  const { prisma } = await import('@/lib/prisma');
  
  // 查詢該夥伴的所有有效預約（排除已取消、已拒絕、已完成的）
  const existingBookings = await prisma.booking.findMany({
    where: {
      schedule: {
        partnerId: partnerId
      },
      status: {
        notIn: ['CANCELLED', 'REJECTED', 'COMPLETED']
      },
      // 如果要更新預約，排除自己
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {})
    },
    include: {
      schedule: {
        select: {
          startTime: true,
          endTime: true
        }
      }
    }
  });

  // 檢查是否有時間重疊
  const conflicts = existingBookings.filter(booking => {
    const bookingStart = new Date(booking.schedule.startTime);
    const bookingEnd = new Date(booking.schedule.endTime);
    return hasTimeOverlap(startTime, endTime, bookingStart, bookingEnd);
  });

  return {
    hasConflict: conflicts.length > 0,
    conflicts: conflicts.map(conflict => ({
      bookingId: conflict.id,
      status: conflict.status,
      startTime: conflict.schedule.startTime,
      endTime: conflict.schedule.endTime
    }))
  };
}

/**
 * 檢查夥伴是否正在執行訂單（當前時間在已確認訂單的時間段內）
 * @param partnerId 夥伴ID
 * @returns 正在執行的訂單信息，如果沒有則返回 null
 */
export async function checkPartnerCurrentlyBusy(partnerId: string) {
  const { prisma } = await import('@/lib/prisma');
  const now = new Date();
  
  // 查詢當前時間在進行中的預約
  const activeBooking = await prisma.booking.findFirst({
    where: {
      schedule: {
        partnerId: partnerId,
        startTime: { lte: now },
        endTime: { gte: now }
      },
      status: {
        in: ['CONFIRMED', 'PARTNER_ACCEPTED']
      }
    },
    include: {
      schedule: {
        select: {
          startTime: true,
          endTime: true
        }
      },
      customer: {
        include: {
          user: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });

  if (activeBooking) {
    const endTime = new Date(activeBooking.schedule.endTime);
    const remainingMinutes = Math.ceil((endTime.getTime() - now.getTime()) / (1000 * 60));
    
    return {
      isBusy: true,
      bookingId: activeBooking.id,
      customerName: activeBooking.customer.user.name || '客戶',
      endTime: endTime,
      remainingMinutes: remainingMinutes
    };
  }

  return {
    isBusy: false,
    bookingId: null,
    customerName: null,
    endTime: null,
    remainingMinutes: 0
  };
}

