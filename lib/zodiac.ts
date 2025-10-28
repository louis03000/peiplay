// 星座計算工具
export function calculateZodiacSign(birthday: Date): string {
  const month = birthday.getMonth() + 1; // getMonth() 返回 0-11，所以 +1
  const day = birthday.getDate();

  // 西方星座日期範圍
  const zodiacSigns = [
    { name: '水瓶座', start: [1, 20], end: [2, 18] },
    { name: '雙魚座', start: [2, 19], end: [3, 20] },
    { name: '白羊座', start: [3, 21], end: [4, 19] },
    { name: '金牛座', start: [4, 20], end: [5, 20] },
    { name: '雙子座', start: [5, 21], end: [6, 20] },
    { name: '巨蟹座', start: [6, 21], end: [7, 22] },
    { name: '獅子座', start: [7, 23], end: [8, 22] },
    { name: '處女座', start: [8, 23], end: [9, 22] },
    { name: '天秤座', start: [9, 23], end: [10, 22] },
    { name: '天蠍座', start: [10, 23], end: [11, 21] },
    { name: '射手座', start: [11, 22], end: [12, 21] },
    { name: '摩羯座', start: [12, 22], end: [1, 19] }
  ];

  for (const sign of zodiacSigns) {
    const [startMonth, startDay] = sign.start;
    const [endMonth, endDay] = sign.end;

    // 處理跨年的情況（摩羯座）
    if (startMonth > endMonth) {
      if ((month === startMonth && day >= startDay) || 
          (month === endMonth && day <= endDay) ||
          (month > startMonth) || 
          (month < endMonth)) {
        return sign.name;
      }
    } else {
      // 正常情況
      if ((month === startMonth && day >= startDay) || 
          (month === endMonth && day <= endDay) ||
          (month > startMonth && month < endMonth)) {
        return sign.name;
      }
    }
  }

  return '未知';
}

// 計算年齡
export function calculateAge(birthday: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthday.getFullYear();
  const monthDiff = today.getMonth() - birthday.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthday.getDate())) {
    age--;
  }
  
  return age;
}

// 格式化日期為中文
export function formatDateChinese(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return `${year}年${month}月${day}日`;
}
