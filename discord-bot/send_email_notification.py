import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
import requests
import json

def send_channel_created_notification(customer_email, customer_name, partner_name, channel_details):
    """發送頻道創建通知給顧客"""
    try:
        # 從環境變數獲取 email 配置
        email_user = os.getenv('EMAIL_USER')
        email_password = os.getenv('EMAIL_APP_PASSWORD')
        
        if not email_user or not email_password:
            print("❌ Email 配置缺失，跳過發送通知")
            return False
        
        # 創建郵件內容
        msg = MIMEMultipart('alternative')
        msg['From'] = f"PeiPlay 系統 <{email_user}>"
        msg['To'] = customer_email
        msg['Subject'] = f"🎮 預約確認 - 與 {partner_name} 的遊戲頻道已創建"
        
        # HTML 郵件內容
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">🎮 PeiPlay 預約確認</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #333; margin-top: 0;">親愛的 {customer_name}，</h2>
                
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    您的預約已被確認！遊戲頻道已成功創建，請準備開始遊戲。
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h3 style="color: #333; margin-top: 0;">🎯 頻道資訊</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #666; width: 120px;"><strong>夥伴姓名：</strong></td>
                            <td style="padding: 8px 0; color: #333;">{partner_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;"><strong>開始時間：</strong></td>
                            <td style="padding: 8px 0; color: #333;">{datetime.fromisoformat(channel_details['startTime']).strftime('%Y/%m/%d %H:%M')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                            <td style="padding: 8px 0; color: #333;">{datetime.fromisoformat(channel_details['endTime']).strftime('%Y/%m/%d %H:%M')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;"><strong>文字頻道：</strong></td>
                            <td style="padding: 8px 0; color: #333;">已創建 (ID: {channel_details['textChannelId']})</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;"><strong>語音頻道：</strong></td>
                            <td style="padding: 8px 0; color: #333;">已創建 (ID: {channel_details['voiceChannelId']})</td>
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
        """
        
        # 添加 HTML 內容
        html_part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(html_part)
        
        # 發送郵件
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(email_user, email_password)
            server.send_message(msg)
        
        print(f"✅ 頻道創建通知已發送給顧客: {customer_email}")
        return True
        
    except Exception as error:
        print(f"❌ 發送頻道創建通知失敗: {error}")
        return False

def send_booking_notification_to_partner(partner_email, partner_name, customer_name, booking_details):
    """發送預約通知給夥伴"""
    try:
        # 從環境變數獲取 email 配置
        email_user = os.getenv('EMAIL_USER')
        email_password = os.getenv('EMAIL_APP_PASSWORD')
        
        if not email_user or not email_password:
            print("❌ Email 配置缺失，跳過發送通知")
            return False
        
        # 創建郵件內容
        msg = MIMEMultipart('alternative')
        msg['From'] = f"PeiPlay 系統 <{email_user}>"
        msg['To'] = partner_email
        msg['Subject'] = f"🎮 新預約通知 - {customer_name} 的預約請求"
        
        # HTML 郵件內容
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">🎮 PeiPlay 預約通知</h1>
            </div>
            
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #333; margin-top: 0;">親愛的 {partner_name}，</h2>
                
                <p style="color: #666; font-size: 16px; line-height: 1.6;">
                    您收到了一個新的預約請求！以下是預約詳情：
                </p>
                
                <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h3 style="color: #333; margin-top: 0;">📋 預約詳情</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; color: #666; width: 120px;"><strong>客戶姓名：</strong></td>
                            <td style="padding: 8px 0; color: #333;">{customer_name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;"><strong>預約類型：</strong></td>
                            <td style="padding: 8px 0; color: #333;">{'即時預約' if booking_details.get('isInstantBooking', False) else '一般預約'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;"><strong>開始時間：</strong></td>
                            <td style="padding: 8px 0; color: #333;">{datetime.fromisoformat(booking_details['startTime']).strftime('%Y/%m/%d %H:%M')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;"><strong>結束時間：</strong></td>
                            <td style="padding: 8px 0; color: #333;">{datetime.fromisoformat(booking_details['endTime']).strftime('%Y/%m/%d %H:%M')}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;"><strong>時長：</strong></td>
                            <td style="padding: 8px 0; color: #333;">{booking_details['duration']} 分鐘</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: #666;"><strong>總費用：</strong></td>
                            <td style="padding: 8px 0; color: #e74c3c; font-weight: bold;">NT$ {booking_details['totalCost']}</td>
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
        """
        
        # 添加 HTML 內容
        html_part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(html_part)
        
        # 發送郵件
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(email_user, email_password)
            server.send_message(msg)
        
        print(f"✅ 預約通知已發送給夥伴: {partner_email}")
        return True
        
    except Exception as error:
        print(f"❌ 發送預約通知失敗: {error}")
        return False

if __name__ == "__main__":
    # 測試 email 功能
    print("🧪 測試 Email 通知功能")
    
    # 測試頻道創建通知
    test_channel_details = {
        'textChannelId': '123456789',
        'voiceChannelId': '987654321',
        'startTime': '2024-01-15T10:00:00Z',
        'endTime': '2024-01-15T12:00:00Z'
    }
    
    # 測試預約通知
    test_booking_details = {
        'duration': 120,
        'startTime': '2024-01-15T10:00:00Z',
        'endTime': '2024-01-15T12:00:00Z',
        'totalCost': 200,
        'isInstantBooking': True
    }
    
    print("請設置環境變數 EMAIL_USER 和 EMAIL_APP_PASSWORD 來測試 email 功能")
