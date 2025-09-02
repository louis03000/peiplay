import nodemailer from 'nodemailer';

// 通知類型
export type NotificationType = 
  | 'BOOKING_CREATED'           // 預約創建
  | 'PAYMENT_SUCCESS'           // 付款成功
  | 'PAYMENT_FAILED'            // 付款失敗
  | 'PARTNER_CONFIRMATION'      // 夥伴確認
  | 'PARTNER_REJECTION'         // 夥伴拒絕
  | 'BOOKING_CANCELLED'         // 預約取消
  | 'BOOKING_REMINDER'          // 預約提醒
  | 'BOOKING_STARTING'          // 預約即將開始
  | 'BOOKING_COMPLETED';        // 預約完成

// 通知資料介面
export interface NotificationData {
  type: NotificationType;
  bookingId: string;
  customerEmail: string;
  customerName: string;
  partnerEmail: string;
  partnerName: string;
  scheduleDate: Date;
  startTime: Date;
  endTime: Date;
  amount?: number;
  orderNumber?: string;
  reason?: string;
}

// Email 配置
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};

// Discord 配置
const DISCORD_CONFIG = {
  webhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
  adminChannelId: process.env.DISCORD_ADMIN_CHANNEL_ID || '',
};

// 創建 Email 傳輸器
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransporter(EMAIL_CONFIG);
  }
  return transporter;
}

// 獲取通知模板
function getNotificationTemplate(data: NotificationData): {
  subject: string;
  html: string;
} {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('zh-TW', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const baseInfo = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">🎮 PeiPlay 遊戲夥伴預約通知</h2>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>預約ID:</strong> ${data.bookingId}</p>
        <p><strong>日期:</strong> ${formatDate(data.scheduleDate)}</p>
        <p><strong>時間:</strong> ${formatTime(data.startTime)} - ${formatTime(data.endTime)}</p>
        <p><strong>顧客:</strong> ${data.customerName}</p>
        <p><strong>夥伴:</strong> ${data.partnerName}</p>
        ${data.amount ? `<p><strong>金額:</strong> NT$ ${data.amount}</p>` : ''}
        ${data.orderNumber ? `<p><strong>訂單編號:</strong> ${data.orderNumber}</p>` : ''}
      </div>
  `;

  switch (data.type) {
    case 'BOOKING_CREATED':
      return {
        subject: '🎯 新預約通知 - PeiPlay',
        html: `
          ${baseInfo}
          <p>✅ 您有新的預約請求！請及時確認。</p>
          <p style="color: #666; font-size: 14px;">此郵件由系統自動發送，請勿回覆。</p>
        </div>
        `,
      };

    case 'PAYMENT_SUCCESS':
      return {
        subject: '💳 付款成功通知 - PeiPlay',
        html: `
          ${baseInfo}
          <p>🎉 付款成功！您的預約已確認。</p>
          <p>📱 Discord 頻道將在預約開始前自動創建。</p>
          <p style="color: #666; font-size: 14px;">此郵件由系統自動發送，請勿回覆。</p>
        </div>
        `,
      };

    case 'PAYMENT_FAILED':
      return {
        subject: '❌ 付款失敗通知 - PeiPlay',
        html: `
          ${baseInfo}
          <p>⚠️ 付款失敗，請重新嘗試。</p>
          <p>🔗 <a href="${process.env.NEXTAUTH_URL}/booking">點擊重新付款</a></p>
          <p style="color: #666; font-size: 14px;">此郵件由系統自動發送，請勿回覆。</p>
        </div>
        `,
      };

    case 'PARTNER_CONFIRMATION':
      return {
        subject: '✅ 夥伴確認通知 - PeiPlay',
        html: `
          ${baseInfo}
          <p>🎯 夥伴已確認您的預約！</p>
          <p>📅 請準時參加，Discord 頻道將自動創建。</p>
          <p style="color: #666; font-size: 14px;">此郵件由系統自動發送，請勿回覆。</p>
        </div>
        `,
      };

    case 'PARTNER_REJECTION':
      return {
        subject: '❌ 預約被拒絕通知 - PeiPlay',
        html: `
          ${baseInfo}
          <p>😔 很抱歉，您的預約被夥伴拒絕。</p>
          <p><strong>原因:</strong> ${data.reason || '未提供原因'}</p>
          <p>💰 退款將在 3-5 個工作天內處理。</p>
          <p style="color: #666; font-size: 14px;">此郵件由系統自動發送，請勿回覆。</p>
        </div>
        `,
      };

    case 'BOOKING_CANCELLED':
      return {
        subject: '🚫 預約取消通知 - PeiPlay',
        html: `
          ${baseInfo}
          <p>🚫 您的預約已被取消。</p>
          <p>💰 退款將在 3-5 個工作天內處理。</p>
          <p style="color: #666; font-size: 14px;">此郵件由系統自動發送，請勿回覆。</p>
        </div>
        `,
      };

    case 'BOOKING_REMINDER':
      return {
        subject: '⏰ 預約提醒通知 - PeiPlay',
        html: `
          ${baseInfo}
          <p>⏰ 提醒：您的預約將在 1 小時後開始！</p>
          <p>🎮 請準備好您的遊戲設備。</p>
          <p>📱 Discord 頻道即將創建。</p>
          <p style="color: #666; font-size: 14px;">此郵件由系統自動發送，請勿回覆。</p>
        </div>
        `,
      };

    case 'BOOKING_STARTING':
      return {
        subject: '🎮 預約開始通知 - PeiPlay',
        html: `
          ${baseInfo}
          <p>🎮 您的預約現在開始！</p>
          <p>📱 Discord 頻道已創建，請立即加入。</p>
          <p style="color: #666; font-size: 14px;">此郵件由系統自動發送，請勿回覆。</p>
        </div>
        `,
      };

    case 'BOOKING_COMPLETED':
      return {
        subject: '🏁 預約完成通知 - PeiPlay',
        html: `
          ${baseInfo}
          <p>🏁 您的預約已完成！</p>
          <p>⭐ 請為您的夥伴評分，幫助我們改善服務。</p>
          <p style="color: #666; font-size: 14px;">此郵件由系統自動發送，請勿回覆。</p>
        </div>
        `,
      };

    default:
      return {
        subject: '📢 PeiPlay 通知',
        html: `
          ${baseInfo}
          <p>📢 您有一則新通知。</p>
          <p style="color: #666; font-size: 14px;">此郵件由系統自動發送，請勿回覆。</p>
        </div>
        `,
      };
  }
}

// 發送 Email 通知
export async function sendEmailNotification(data: NotificationData): Promise<boolean> {
  try {
    if (!EMAIL_CONFIG.auth.user || !EMAIL_CONFIG.auth.pass) {
      console.warn('⚠️ Email 配置未設置，跳過 Email 通知');
      return false;
    }

    const transporter = getTransporter();
    const template = getNotificationTemplate(data);

    const mailOptions = {
      from: `"PeiPlay" <${EMAIL_CONFIG.auth.user}>`,
      to: data.customerEmail,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email 通知已發送: ${data.type} -> ${data.customerEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Email 通知發送失敗: ${error}`);
    return false;
  }
}

// 發送 Discord 通知
export async function sendDiscordNotification(data: NotificationData): Promise<boolean> {
  try {
    if (!DISCORD_CONFIG.webhookUrl) {
      console.warn('⚠️ Discord Webhook 未設置，跳過 Discord 通知');
      return false;
    }

    const embed = {
      title: getDiscordNotificationTitle(data.type),
      description: getDiscordNotificationDescription(data),
      color: getDiscordNotificationColor(data.type),
      fields: [
        {
          name: '📋 預約ID',
          value: data.bookingId,
          inline: true,
        },
        {
          name: '👤 顧客',
          value: data.customerName,
          inline: true,
        },
        {
          name: '👥 夥伴',
          value: data.partnerName,
          inline: true,
        },
        {
          name: '📅 日期',
          value: new Intl.DateTimeFormat('zh-TW').format(data.scheduleDate),
          inline: true,
        },
        {
          name: '⏰ 時間',
          value: `${new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit' }).format(data.startTime)} - ${new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit' }).format(data.endTime)}`,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    if (data.amount) {
      embed.fields.push({
        name: '💰 金額',
        value: `NT$ ${data.amount}`,
        inline: true,
      });
    }

    if (data.orderNumber) {
      embed.fields.push({
        name: '📝 訂單編號',
        value: data.orderNumber,
        inline: true,
      });
    }

    if (data.reason) {
      embed.fields.push({
        name: '📝 原因',
        value: data.reason,
        inline: false,
      });
    }

    const response = await fetch(DISCORD_CONFIG.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (response.ok) {
      console.log(`✅ Discord 通知已發送: ${data.type}`);
      return true;
    } else {
      console.error(`❌ Discord 通知發送失敗: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Discord 通知發送失敗: ${error}`);
    return false;
  }
}

// 獲取 Discord 通知標題
function getDiscordNotificationTitle(type: NotificationType): string {
  const titles = {
    BOOKING_CREATED: '🎯 新預約通知',
    PAYMENT_SUCCESS: '💳 付款成功通知',
    PAYMENT_FAILED: '❌ 付款失敗通知',
    PARTNER_CONFIRMATION: '✅ 夥伴確認通知',
    PARTNER_REJECTION: '❌ 預約被拒絕通知',
    BOOKING_CANCELLED: '🚫 預約取消通知',
    BOOKING_REMINDER: '⏰ 預約提醒通知',
    BOOKING_STARTING: '🎮 預約開始通知',
    BOOKING_COMPLETED: '🏁 預約完成通知',
  };
  return titles[type] || '📢 通知';
}

// 獲取 Discord 通知描述
function getDiscordNotificationDescription(data: NotificationData): string {
  const descriptions = {
    BOOKING_CREATED: '您有新的預約請求！請及時確認。',
    PAYMENT_SUCCESS: '付款成功！預約已確認。',
    PAYMENT_FAILED: '付款失敗，請重新嘗試。',
    PARTNER_CONFIRMATION: '夥伴已確認您的預約！',
    PARTNER_REJECTION: '很抱歉，您的預約被夥伴拒絕。',
    BOOKING_CANCELLED: '您的預約已被取消。',
    BOOKING_REMINDER: '提醒：您的預約將在 1 小時後開始！',
    BOOKING_STARTING: '您的預約現在開始！',
    BOOKING_COMPLETED: '您的預約已完成！',
  };
  return descriptions[data.type] || '您有一則新通知。';
}

// 獲取 Discord 通知顏色
function getDiscordNotificationColor(type: NotificationType): number {
  const colors = {
    BOOKING_CREATED: 0x00ff00,      // 綠色
    PAYMENT_SUCCESS: 0x00ff00,      // 綠色
    PAYMENT_FAILED: 0xff0000,       // 紅色
    PARTNER_CONFIRMATION: 0x00ff00, // 綠色
    PARTNER_REJECTION: 0xff0000,    // 紅色
    BOOKING_CANCELLED: 0xff0000,    // 紅色
    BOOKING_REMINDER: 0xffff00,     // 黃色
    BOOKING_STARTING: 0x00ffff,     // 青色
    BOOKING_COMPLETED: 0x0000ff,    // 藍色
  };
  return colors[type] || 0x808080;  // 預設灰色
}

// 發送綜合通知（Email + Discord）
export async function sendNotification(data: NotificationData): Promise<{
  email: boolean;
  discord: boolean;
}> {
  const [emailResult, discordResult] = await Promise.allSettled([
    sendEmailNotification(data),
    sendDiscordNotification(data),
  ]);

  return {
    email: emailResult.status === 'fulfilled' ? emailResult.value : false,
    discord: discordResult.status === 'fulfilled' ? discordResult.value : false,
  };
}

// 發送管理員通知
export async function sendAdminNotification(message: string, data?: any): Promise<boolean> {
  try {
    if (!DISCORD_CONFIG.webhookUrl) {
      console.warn('⚠️ Discord Webhook 未設置，跳過管理員通知');
      return false;
    }

    const embed = {
      title: '🔔 管理員通知',
      description: message,
      color: 0xff6b6b,
      timestamp: new Date().toISOString(),
    };

    if (data) {
      embed.fields = [
        {
          name: '📊 詳細資料',
          value: '```json\n' + JSON.stringify(data, null, 2) + '\n```',
          inline: false,
        },
      ];
    }

    const response = await fetch(DISCORD_CONFIG.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (response.ok) {
      console.log('✅ 管理員通知已發送');
      return true;
    } else {
      console.error(`❌ 管理員通知發送失敗: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ 管理員通知發送失敗: ${error}`);
    return false;
  }
}
