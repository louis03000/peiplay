import nodemailer from 'nodemailer';
import { NotificationType } from './messaging';

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
                <td style="padding: 8px 0; color: #333;">${new Date(bookingDetails.startTime).toLocaleString('zh-TW')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${new Date(bookingDetails.endTime).toLocaleString('zh-TW')}</td>
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
              📅 一般預約：請在 Discord 中確認後創建頻道
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
                <td style="padding: 8px 0; color: #333;">${new Date(channelDetails.startTime).toLocaleString('zh-TW')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${new Date(channelDetails.endTime).toLocaleString('zh-TW')}</td>
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
                <td style="padding: 8px 0; color: #333;">${new Date(bookingDetails.startTime).toLocaleString('zh-TW')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                <td style="padding: 8px 0; color: #333;">${new Date(bookingDetails.endTime).toLocaleString('zh-TW')}</td>
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
                <td style="padding: 8px 0; color: #333;">${new Date(notificationData.createdAt).toLocaleString('zh-TW')}</td>
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
