import nodemailer from 'nodemailer';
import { NotificationType } from './messaging';

// 輔助函數：格式化時間為台灣時區（Asia/Taipei, UTC+8）
function formatTaiwanTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/,/g, ' ').replace(/\//g, '/');
}

// 輔助函數：格式化時長為 "X 小時 Y 分鐘" 格式
function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const hoursPart = Math.floor(totalMinutes / 60);
  const minutesPart = totalMinutes % 60;
  
  if (hoursPart === 0) {
    return `${minutesPart} 分鐘`;
  } else if (minutesPart === 0) {
    return `${hoursPart} 小時`;
  } else {
    return `${hoursPart} 小時 ${minutesPart} 分鐘`;
  }
}

// 創建 Gmail SMTP 傳輸器
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER, // Gmail 地址
      pass: process.env.EMAIL_APP_PASSWORD // Gmail 應用程式密碼
    }
  });
};

// 發送預約確認通知給顧客
export async function sendBookingConfirmationEmail(
  customerEmail: string,
  customerName: string,
  partnerName: string,
  bookingDetails: {
    duration: number;
    startTime: string;
    endTime: string;
    totalCost: number;
    bookingId: string;
  }
) {
  try {
    const transporter = createTransporter();
    
    const subject = `🎉 預約確認 - ${partnerName} 已確認您的預約`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🎉 預約確認通知</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${customerName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            好消息！您的預約已被夥伴確認。以下是預約詳情：
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 預約詳情</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>夥伴姓名：</strong></td>
                <td style="padding: 8px 0; color: #333;">${partnerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>預約編號：</strong></td>
                <td style="padding: 8px 0; color: #333;">${bookingDetails.bookingId}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>開始時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.startTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.endTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>時長：</strong></td>
                <td style="padding: 8px 0; color: #333;">${bookingDetails.duration} 分鐘</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>總費用：</strong></td>
                <td style="padding: 8px 0; color: #e74c3c; font-weight: bold;">NT$ ${bookingDetails.totalCost}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #2d5a2d; font-weight: bold;">
              ✅ 預約已確認！<br>
              📅 請在預約時間準時上線，夥伴會與您聯繫。<br>
              💬 Discord 頻道將在預約開始前自動創建。
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://peiplay.vercel.app/" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; 
                      font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              🌐 前往 PeiPlay 網站
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如有任何問題，請聯繫我們的客服團隊。<br>
            祝您遊戲愉快！ 🎮
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>此郵件由 PeiPlay 系統自動發送，請勿回覆。</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject: subject,
      html: html
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ 預約確認通知已發送給顧客: ${customerEmail}`);
    
  } catch (error) {
    console.error('發送預約確認通知失敗:', error);
    throw error;
  }
}

// 發送預約通知給夥伴
export async function sendBookingNotificationToPartner(
  partnerEmail: string,
  partnerName: string,
  customerName: string,
  bookingDetails: {
    duration: number;
    startTime: string;
    endTime: string;
    totalCost: number;
    isInstantBooking: boolean;
  }
) {
  try {
    const transporter = createTransporter();
    
    const subject = `🎮 新預約通知 - ${customerName} 的預約請求`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🎮 PeiPlay 預約通知</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${partnerName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            您收到了一個新的預約請求！以下是預約詳情：
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 預約詳情</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>客戶姓名：</strong></td>
                <td style="padding: 8px 0; color: #333;">${customerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>預約類型：</strong></td>
                <td style="padding: 8px 0; color: #333;">${bookingDetails.isInstantBooking ? '即時預約' : '一般預約'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>開始時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.startTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.endTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>時長：</strong></td>
                <td style="padding: 8px 0; color: #333;">${bookingDetails.duration} 分鐘</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>總費用：</strong></td>
                <td style="padding: 8px 0; color: #e74c3c; font-weight: bold;">NT$ ${bookingDetails.totalCost}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #2d5a2d; font-weight: bold;">
              ⚡ 即時預約：頻道將在 3 分鐘內自動創建<br>
              📅 一般預約：請在網站中確認後創建頻道
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://peiplay.vercel.app/" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; 
                      font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
              🌐 前往 PeiPlay 網站
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如有任何問題，請聯繫我們的客服團隊。<br>
            祝您遊戲愉快！ 🎮
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>此郵件由 PeiPlay 系統自動發送，請勿回覆。</p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: `"PeiPlay 系統" <${process.env.EMAIL_USER}>`,
      to: partnerEmail,
      subject,
      html
    });
    
    console.log(`✅ 預約通知已發送給夥伴: ${partnerEmail}`);
    return true;
  } catch (error) {
    console.error('❌ 發送預約通知給夥伴失敗:', error);
    return false;
  }
}

// 發送頻道創建通知給顧客
export async function sendChannelCreatedNotificationToCustomer(
  customerEmail: string,
  customerName: string,
  partnerName: string,
  channelDetails: {
    textChannelId: string;
    voiceChannelId: string;
    startTime: string;
    endTime: string;
  }
) {
  try {
    const transporter = createTransporter();
    
    const subject = `🎮 預約確認 - 與 ${partnerName} 的遊戲頻道已創建`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🎮 PeiPlay 預約確認</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${customerName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            您的預約已被確認！遊戲頻道已成功創建，請準備開始遊戲。
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">🎯 頻道資訊</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>夥伴姓名：</strong></td>
                <td style="padding: 8px 0; color: #333;">${partnerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>開始時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(channelDetails.startTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(channelDetails.endTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>文字頻道：</strong></td>
                <td style="padding: 8px 0; color: #333;">已創建 (ID: ${channelDetails.textChannelId})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>語音頻道：</strong></td>
                <td style="padding: 8px 0; color: #333;">已創建 (ID: ${channelDetails.voiceChannelId})</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #1565c0; font-weight: bold;">
              🎮 請前往 Discord 查看您的專屬遊戲頻道<br>
              💬 頻道將在預約時間結束後自動關閉
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如有任何問題，請聯繫我們的客服團隊。<br>
            祝您遊戲愉快！ 🎮
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>此郵件由 PeiPlay 系統自動發送，請勿回覆。</p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: `"PeiPlay 系統" <${process.env.EMAIL_USER}>`,
      to: customerEmail,
      subject,
      html
    });
    
    console.log(`✅ 頻道創建通知已發送給顧客: ${customerEmail}`);
    return true;
  } catch (error) {
    console.error('❌ 發送頻道創建通知給顧客失敗:', error);
    return false;
  }
}

// 發送預約取消通知
export async function sendBookingCancellationNotification(
  email: string,
  name: string,
  bookingDetails: {
    partnerName?: string;
    customerName?: string;
    startTime: string;
    endTime: string;
    reason?: string;
  },
  isPartner: boolean = false
) {
  try {
    const transporter = createTransporter();
    
    const subject = `❌ 預約取消通知 - ${isPartner ? '顧客' : '夥伴'} 取消了預約`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">❌ 預約取消通知</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${name}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            很抱歉通知您，${isPartner ? '顧客' : '夥伴'} 取消了以下預約：
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 取消的預約詳情</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>${isPartner ? '顧客姓名：' : '夥伴姓名：'}</strong></td>
                <td style="padding: 8px 0; color: #333;">${isPartner ? bookingDetails.customerName : bookingDetails.partnerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>開始時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.startTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.endTime)}</td>
              </tr>
              ${bookingDetails.reason ? `
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>取消原因：</strong></td>
                <td style="padding: 8px 0; color: #333;">${bookingDetails.reason}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-weight: bold;">
              💡 提示：您可以重新預約其他時段，或聯繫客服了解更多選項
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如有任何問題，請聯繫我們的客服團隊。<br>
            感謝您的理解！
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>此郵件由 PeiPlay 系統自動發送，請勿回覆。</p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: `"PeiPlay 系統" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html
    });
    
    console.log(`✅ 預約取消通知已發送: ${email}`);
    return true;
  } catch (error) {
    console.error('❌ 發送預約取消通知失敗:', error);
    return false;
  }
}


// 發送系統通知到 Email
export async function sendNotificationToEmail(
  userEmail: string,
  userName: string,
  notificationData: {
    type: NotificationType;
    title: string;
    content: string;
    createdAt: string;
    data?: any;
  }
) {
  try {
    const transporter = createTransporter();
    
    const typeText = {
      'BOOKING_CREATED': '新預約',
      'BOOKING_CONFIRMED': '預約確認',
      'BOOKING_CANCELLED': '預約取消',
      'BOOKING_REMINDER': '預約提醒',
      'PAYMENT_SUCCESS': '付款成功',
      'PAYMENT_FAILED': '付款失敗',
      'PARTNER_APPLICATION': '夥伴申請',
      'SYSTEM_ANNOUNCEMENT': '系統公告',
      'MESSAGE_RECEIVED': '新訊息'
    }[notificationData.type] || '系統通知';
    
    const subject = `🔔 ${typeText} - ${notificationData.title}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🔔 PeiPlay 系統通知</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${userName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            您收到了一個新的系統通知：
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 通知詳情</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>類型：</strong></td>
                <td style="padding: 8px 0; color: #333;">${typeText}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>標題：</strong></td>
                <td style="padding: 8px 0; color: #333;">${notificationData.title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(notificationData.createdAt)}</td>
              </tr>
            </table>
            
            <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
              <h4 style="color: #333; margin-top: 0;">通知內容：</h4>
              <p style="color: #666; line-height: 1.6; margin: 0;">${notificationData.content}</p>
            </div>
          </div>
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3004'}/messages" 
               style="display: inline-block; background: #f39c12; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              🔔 查看所有通知
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            此郵件是 PeiPlay 系統的自動通知。<br>
            請登入系統查看完整通知內容。
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>此郵件由 PeiPlay 系統自動發送，請勿回覆。</p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: `"PeiPlay 系統通知" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject,
      html
    });
    
    console.log(`✅ 系統通知 Email 已發送: ${userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ 發送系統通知 Email 失敗:', error);
    return false;
  }
}

// 發送密碼重設 Email
export async function sendPasswordResetEmail(
  userEmail: string,
  userName: string,
  resetToken: string
) {
  try {
    const transporter = createTransporter();
    
    const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3004'}/auth/reset-password?token=${resetToken}`;
    
    const subject = `🔐 PeiPlay 密碼重設請求`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🔐 密碼重設</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${userName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            我們收到了您的密碼重設請求。請點擊下方按鈕重設您的密碼：
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; background: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              🔐 重設密碼
            </a>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-weight: bold;">
              ⚠️ 安全提醒：<br>
              • 此連結將在 1 小時後失效<br>
              • 如果您沒有請求重設密碼，請忽略此郵件<br>
              • 請勿將此連結分享給他人
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如果按鈕無法點擊，請複製以下連結到瀏覽器：<br>
            <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>此郵件由 PeiPlay 系統自動發送，請勿回覆。</p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: `"PeiPlay 安全中心" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject,
      html
    });
    
    console.log(`✅ 密碼重設 Email 已發送: ${userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ 發送密碼重設 Email 失敗:', error);
    return false;
  }
}

// 發送 Email 驗證碼
export async function sendEmailVerificationCode(
  userEmail: string,
  userName: string,
  verificationCode: string
) {
  try {
    const transporter = createTransporter();
    
    const subject = `🔐 PeiPlay Email 驗證碼`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🔐 Email 驗證</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${userName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            歡迎加入 PeiPlay！請使用以下驗證碼來驗證您的 Email 地址：
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background: #667eea; color: white; padding: 20px 40px; border-radius: 10px; font-size: 32px; font-weight: bold; letter-spacing: 5px;">
              ${verificationCode}
            </div>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-weight: bold;">
              ⚠️ 重要提醒：<br>
              • 此驗證碼將在 10 分鐘後失效<br>
              • 請勿將此驗證碼分享給他人<br>
              • 如果您沒有註冊 PeiPlay 帳號，請忽略此郵件
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            驗證完成後，您就可以開始使用 PeiPlay 的所有功能了！<br>
            如有任何問題，請聯繫我們的客服團隊。
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
          <p>此郵件由 PeiPlay 系統自動發送，請勿回覆。</p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: `"PeiPlay 驗證中心" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject,
      html
    });
    
    console.log(`✅ Email 驗證碼已發送: ${userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ 發送 Email 驗證碼失敗:', error);
    return false;
  }
}

// 發送預約通知給夥伴
export async function sendBookingNotificationEmail(
  partnerEmail: string,
  partnerName: string,
  customerName: string,
  bookingDetails: {
    bookingId: string;
    startTime: string;
    endTime: string;
    duration: number;
    totalCost: number;
    customerName: string;
    customerEmail: string;
  }
) {
  try {
    const transporter = createTransporter();
    
    const subject = `📅 新預約通知 - ${customerName} 預約了您的服務`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">📅 新預約通知</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${partnerName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            您有一個新的預約請求！請儘快登入 PeiPlay 確認或拒絕此預約。
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 預約詳情</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>客戶姓名：</strong></td>
                <td style="padding: 8px 0; color: #333;">${bookingDetails.customerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>預約時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.startTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.endTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>時長：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatDuration(bookingDetails.duration)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>總費用：</strong></td>
                <td style="padding: 8px 0; color: #333; font-weight: bold; color: #e74c3c;">NT$ ${bookingDetails.totalCost}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>預約 ID：</strong></td>
                <td style="padding: 8px 0; color: #333; font-family: monospace;">${bookingDetails.bookingId}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/bookings" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
              🔗 前往 PeiPlay 處理預約
            </a>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>⚠️ 重要提醒：</strong>請在 24 小時內回應此預約請求，逾期未回應將自動取消。
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如有任何問題，請聯繫我們的客服團隊。
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            此郵件由 PeiPlay 系統自動發送，請勿直接回覆。
          </p>
        </div>
      </div>
    `;
    
    console.log(`[email] 📧 準備發送預約通知郵件給: ${partnerEmail}`)
    console.log(`[email] 📧 郵件主題: ${subject}`)
    console.log(`[email] 📧 發送者: ${process.env.EMAIL_USER}`)
    
    const mailResult = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: partnerEmail,
      subject: subject,
      html: html
    });
    
    console.log(`[email] ✅ 預約通知 Email 已發送給夥伴: ${partnerEmail}`)
    console.log(`[email] 📧 郵件 ID: ${mailResult.messageId}`)
    
  } catch (error) {
    console.error(`[email] ❌ 預約通知 Email 發送失敗給 ${partnerEmail}:`, error)
    if (error instanceof Error) {
      console.error(`[email] ❌ 錯誤訊息: ${error.message}`)
      console.error(`[email] ❌ 錯誤堆疊: ${error.stack}`)
    }
    throw error;
  }
}

// 發送預約拒絕通知給客戶
export async function sendBookingRejectionEmail(
  customerEmail: string,
  customerName: string,
  partnerName: string,
  bookingDetails: {
    startTime: string;
    endTime: string;
    bookingId: string;
  }
) {
  try {
    const transporter = createTransporter();
    
    const subject = `😔 預約被拒絕 - ${partnerName} 無法接受您的預約`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">😔 預約被拒絕</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${customerName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            很抱歉，您對 ${partnerName} 的預約請求已被拒絕。請查看其他可用的夥伴或重新安排時間。
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 被拒絕的預約詳情</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>夥伴姓名：</strong></td>
                <td style="padding: 8px 0; color: #333;">${partnerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>預約時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.startTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.endTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>預約 ID：</strong></td>
                <td style="padding: 8px 0; color: #333; font-family: monospace;">${bookingDetails.bookingId}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/booking" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
              🔍 尋找其他夥伴
            </a>
          </div>
          
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #0c5460; font-size: 14px;">
              <strong>💡 建議：</strong>您可以嘗試預約其他夥伴的時段，或選擇不同的時間。
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如有任何問題，請聯繫我們的客服團隊。
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            此郵件由 PeiPlay 系統自動發送，請勿直接回覆。
          </p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject: subject,
      html: html
    });
    
    console.log(`✅ 預約拒絕通知 Email 已發送給客戶: ${customerEmail}`);
    
  } catch (error) {
    console.error('預約拒絕通知 Email 發送失敗:', error);
    throw error;
  }
}

// 通用 Email 發送函數
// 發送警告郵件給用戶
export async function sendWarningEmail(
  userEmail: string,
  userName: string,
  warningData: {
    cancellationCount?: number;
    rejectionCount?: number;
    warningType: 'FREQUENT_CANCELLATIONS' | 'FREQUENT_REJECTIONS';
  }
) {
  try {
    const transporter = createTransporter();
    
    let subject = '';
    let warningMessage = '';
    
    if (warningData.warningType === 'FREQUENT_CANCELLATIONS') {
      subject = `⚠️ 預約取消頻繁警告 - PeiPlay`;
      warningMessage = `
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          我們注意到您在過去一週內已取消 ${warningData.cancellationCount} 次預約。
        </p>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          頻繁取消預約會影響其他用戶的權益，也可能影響夥伴的排程安排。
        </p>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          <strong>請注意：</strong>如果持續出現頻繁取消的情況，我們可能會採取進一步的措施。
        </p>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          建議您在預約前仔細確認時間安排，避免不必要的取消。
        </p>
      `;
    } else if (warningData.warningType === 'FREQUENT_REJECTIONS') {
      subject = `⚠️ 預約拒絕頻繁警告 - PeiPlay`;
      warningMessage = `
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          我們注意到您在過去一週內已拒絕 ${warningData.rejectionCount} 次預約請求。
        </p>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          頻繁拒絕預約會影響顧客的體驗，也可能影響您的夥伴評級。
        </p>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          <strong>請注意：</strong>如果持續出現頻繁拒絕的情況，我們可能會採取進一步的措施。
        </p>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          建議您仔細評估預約請求，只有在確實無法接受時才拒絕。
        </p>
      `;
    }
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">⚠️ 警告通知</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${userName}，</h2>
          
          ${warningMessage}
          
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>💡 提醒：</strong>如有任何疑問或需要協助，請聯繫我們的客服團隊。
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #999; font-size: 12px;">
              此為系統自動發送的警告通知，請勿回覆此郵件。
            </p>
          </div>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: `"PeiPlay" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject,
      html,
    });
    
    console.log(`✅ 警告郵件已發送給 ${userEmail}`);
    return true;
  } catch (error) {
    console.error('❌ 發送警告郵件失敗:', error);
    return false;
  }
}

// 🔥 多人陪玩：夥伴拒絕時通知顧客
export async function sendMultiPlayerPartnerRejectionEmail(
  customerEmail: string,
  customerName: string,
  rejectedPartnerName: string,
  multiPlayerBookingId: string,
  bookingDetails: {
    startTime: string;
    endTime: string;
    totalPartners: number;
    confirmedPartners: number;
  }
) {
  try {
    const transporter = createTransporter();
    
    const subject = `😔 多人陪玩預約 - ${rejectedPartnerName} 拒絕了您的預約`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">😔 夥伴拒絕通知</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${customerName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            很抱歉，您的多人陪玩預約中，夥伴 <strong>${rejectedPartnerName}</strong> 已拒絕了您的預約請求。
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 預約詳情</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 150px;"><strong>拒絕的夥伴：</strong></td>
                <td style="padding: 8px 0; color: #333;">${rejectedPartnerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>預約時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.startTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.endTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>已確認夥伴：</strong></td>
                <td style="padding: 8px 0; color: #333;">${bookingDetails.confirmedPartners} / ${bookingDetails.totalPartners}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>💡 重要提示：</strong>您可以選擇重新選擇其他夥伴來替換 ${rejectedPartnerName}，或取消此筆訂單。
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/booking/multi-player?bookingId=${multiPlayerBookingId}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; margin: 5px;">
              🔄 重新選擇夥伴
            </a>
            <a href="${process.env.NEXTAUTH_URL}/bookings" 
               style="display: inline-block; background: #6c757d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px; margin: 5px;">
              📋 查看我的預約
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如有任何問題，請聯繫我們的客服團隊。
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            此郵件由 PeiPlay 系統自動發送，請勿直接回覆。
          </p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject: subject,
      html: html
    });
    
    console.log(`✅ 多人陪玩夥伴拒絕通知 Email 已發送給客戶: ${customerEmail}`);
    
  } catch (error) {
    console.error('多人陪玩夥伴拒絕通知 Email 發送失敗:', error);
    throw error;
  }
}

// 🔥 多人陪玩：訂單取消時通知已同意的夥伴
export async function sendMultiPlayerBookingCancelledEmail(
  partnerEmail: string,
  partnerName: string,
  customerName: string,
  rejectedPartnerName: string,
  bookingDetails: {
    startTime: string;
    endTime: string;
    bookingId: string;
  }
) {
  try {
    const transporter = createTransporter();
    
    const subject = `😔 多人陪玩預約已取消`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">😔 預約已取消</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${partnerName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            很抱歉通知您，您已同意的多人陪玩預約已被顧客取消。
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 取消原因</h3>
            <p style="color: #666; line-height: 1.6;">
              因 <strong>${rejectedPartnerName}</strong> 夥伴拒絕此訂單，顧客 <strong>${customerName}</strong> 決定取消整筆訂單。對於此次變更造成的不便，我們深表歉意，感謝您的理解與配合。
            </p>
            
            <h3 style="color: #333; margin-top: 20px;">📋 預約詳情</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>顧客姓名：</strong></td>
                <td style="padding: 8px 0; color: #333;">${customerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>預約時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.startTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.endTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>預約 ID：</strong></td>
                <td style="padding: 8px 0; color: #333; font-family: monospace;">${bookingDetails.bookingId}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #0c5460; font-size: 14px;">
              <strong>💡 說明：</strong>此筆訂單已標記為取消，不會出現在您的接單紀錄中，也不會計入申請提領。
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/bookings" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
              📋 查看我的預約
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如有任何問題，請聯繫我們的客服團隊。
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            此郵件由 PeiPlay 系統自動發送，請勿直接回覆。
          </p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: partnerEmail,
      subject: subject,
      html: html
    });
    
    console.log(`✅ 多人陪玩取消通知 Email 已發送給夥伴: ${partnerEmail}`);
    
  } catch (error) {
    console.error('多人陪玩取消通知 Email 發送失敗:', error);
    throw error;
  }
}

// 🔥 多人陪玩：頻道已自動創建通知（開始前5分鐘）
export async function sendMultiPlayerChannelsCreatedEmail(
  email: string,
  name: string,
  isCustomer: boolean,
  bookingDetails: {
    startTime: string;
    endTime: string;
    partnerNames?: string[];
    customerName?: string;
    multiPlayerBookingId: string;
  }
) {
  try {
    const transporter = createTransporter();
    
    const subject = isCustomer 
      ? `🎮 多人陪玩頻道已創建 - 預約即將開始`
      : `🎮 多人陪玩頻道已創建 - 預約即將開始`;
    
    const roleText = isCustomer ? '顧客' : '夥伴';
    const partnerList = bookingDetails.partnerNames?.join('、') || '夥伴們';
    const customerName = bookingDetails.customerName || '顧客';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🎮 頻道已創建</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${name}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            您的多人陪玩預約即將開始！系統已自動為您創建 Discord 文字頻道和語音頻道。
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 預約詳情</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>開始時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.startTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.endTime)}</td>
              </tr>
              ${isCustomer ? `
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>參與夥伴：</strong></td>
                <td style="padding: 8px 0; color: #333;">${partnerList}</td>
              </tr>
              ` : `
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>顧客：</strong></td>
                <td style="padding: 8px 0; color: #333;">${customerName}</td>
              </tr>
              `}
            </table>
          </div>
          
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #0c5460; font-size: 14px;">
              <strong>💡 提醒：</strong>請前往 Discord 查看已創建的頻道。文字頻道用於溝通，語音頻道用於遊戲語音。
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/booking/multi-player" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
              📋 查看預約詳情
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如有任何問題，請聯繫我們的客服團隊。
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            此郵件由 PeiPlay 系統自動發送，請勿直接回覆。
          </p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: html
    });
    
    console.log(`✅ 多人陪玩頻道創建通知 Email 已發送給${roleText}: ${email}`);
    
  } catch (error) {
    console.error('多人陪玩頻道創建通知 Email 發送失敗:', error);
    throw error;
  }
}

// 🔥 多人陪玩：自動取消通知（所有夥伴都拒絕或沒有回應）
export async function sendMultiPlayerAutoCancelledEmail(
  customerEmail: string,
  customerName: string,
  bookingDetails: {
    startTime: string;
    endTime: string;
    multiPlayerBookingId: string;
    reason: string;
  }
) {
  try {
    const transporter = createTransporter();
    
    const subject = `😔 多人陪玩預約已自動取消`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">😔 預約已自動取消</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${customerName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            很抱歉通知您，您的多人陪玩預約因以下原因已自動取消：
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 取消原因</h3>
            <p style="color: #666; line-height: 1.6;">
              ${bookingDetails.reason}
            </p>
            
            <h3 style="color: #333; margin-top: 20px;">📋 預約詳情</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 120px;"><strong>開始時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.startTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${formatTaiwanTime(bookingDetails.endTime)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>預約 ID：</strong></td>
                <td style="padding: 8px 0; color: #333; font-family: monospace;">${bookingDetails.multiPlayerBookingId}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #0c5460; font-size: 14px;">
              <strong>💡 說明：</strong>此筆訂單已標記為取消，不會產生任何費用。您可以重新選擇夥伴創建新的預約。
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/booking/multi-player" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
              📋 重新預約
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如有任何問題，請聯繫我們的客服團隊。
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            此郵件由 PeiPlay 系統自動發送，請勿直接回覆。
          </p>
        </div>
      </div>
    `;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject: subject,
      html: html
    });
    
    console.log(`✅ 多人陪玩自動取消通知 Email 已發送給顧客: ${customerEmail}`);
    
  } catch (error) {
    console.error('多人陪玩自動取消通知 Email 發送失敗:', error);
    throw error;
  }
}

export async function sendEmail({
  to,
  subject,
  html,
  text
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) {
  try {
    const transporter = createTransporter();
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      html: html,
      text: text
    });
    
    console.log(`✅ Email 已發送給: ${to}`);
    
  } catch (error) {
    console.error('Email 發送失敗:', error);
    throw error;
  }
}

// 發送群組預約加入通知給夥伴
export async function sendGroupBookingJoinNotification(
  partnerEmail: string,
  partnerName: string,
  customerName: string,
  groupBookingDetails: {
    groupBookingId: string;
    title: string;
    startTime: string;
    endTime: string;
    pricePerPerson: number;
    currentParticipants: number;
    maxParticipants: number;
  }
) {
  try {
    const transporter = createTransporter();
    
    const startTimeFormatted = formatTaiwanTime(groupBookingDetails.startTime);
    const endTimeFormatted = formatTaiwanTime(groupBookingDetails.endTime);
    const duration = (new Date(groupBookingDetails.endTime).getTime() - new Date(groupBookingDetails.startTime).getTime()) / (1000 * 60 * 60);
    const durationFormatted = formatDuration(duration);
    
    const subject = `👥 有人加入了您的群組預約 - ${groupBookingDetails.title}`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">👥 群組預約加入通知</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">親愛的 ${partnerName}，</h2>
          
          <p style="color: #666; font-size: 16px; line-height: 1.6;">
            有新的成員加入了您的群組預約！以下是詳細資訊：
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #333; margin-top: 0;">📋 群組預約詳情</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666; width: 140px;"><strong>群組名稱：</strong></td>
                <td style="padding: 8px 0; color: #333;">${groupBookingDetails.title || '未命名群組'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>新加入成員：</strong></td>
                <td style="padding: 8px 0; color: #333; font-weight: bold;">${customerName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>開始時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${startTimeFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${endTimeFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>時長：</strong></td>
                <td style="padding: 8px 0; color: #333;">${durationFormatted}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>每人價格：</strong></td>
                <td style="padding: 8px 0; color: #e74c3c; font-weight: bold;">NT$ ${groupBookingDetails.pricePerPerson}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>參與人數：</strong></td>
                <td style="padding: 8px 0; color: #333; font-weight: bold;">${groupBookingDetails.currentParticipants} / ${groupBookingDetails.maxParticipants} 人</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>群組 ID：</strong></td>
                <td style="padding: 8px 0; color: #999; font-size: 12px;">${groupBookingDetails.groupBookingId}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXTAUTH_URL}/partner/schedule" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
              🔗 前往 PeiPlay 查看群組預約
            </a>
          </div>
          
          <div style="background: #e8f5e8; border: 1px solid #c3e6cb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #2d5a2d; font-size: 14px;">
              <strong>💡 提醒：</strong>當群組預約達到開始前10分鐘時，系統將自動關閉群組並創建 Discord 頻道。
            </p>
          </div>
          
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            如有任何問題，請聯繫我們的客服團隊。
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
            此郵件由 PeiPlay 系統自動發送，請勿直接回覆。
          </p>
        </div>
      </div>
    `;
    
    console.log(`[email] 📧 準備發送群組預約加入通知郵件給: ${partnerEmail}`)
    console.log(`[email] 📧 郵件主題: ${subject}`)
    
    const mailResult = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: partnerEmail,
      subject: subject,
      html: html
    });
    
    console.log(`[email] ✅ 群組預約加入通知 Email 已發送給夥伴: ${partnerEmail}`)
    console.log(`[email] 📧 郵件 ID: ${mailResult.messageId}`)
    
    return true;
  } catch (error) {
    console.error('❌ 發送群組預約加入通知失敗:', error);
    return false;
  }
}