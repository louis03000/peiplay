import nodemailer from 'nodemailer';

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
