import asyncio
import requests
import json

async def test_discord_delete():
    """測試 Discord 頻道刪除功能"""
    
    # 測試數據
    test_booking_id = "test_booking_123"
    
    print("🧪 測試 Discord 頻道刪除功能")
    print(f"📋 測試預約 ID: {test_booking_id}")
    
    try:
        # 發送刪除請求到 Discord bot
        response = requests.post(
            "http://localhost:5001/delete",
            headers={"Content-Type": "application/json"},
            json={"booking_id": test_booking_id},
            timeout=10
        )
        
        print(f"📡 回應狀態碼: {response.status_code}")
        print(f"📄 回應內容: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ 測試成功！頻道刪除請求已處理")
            else:
                print("❌ 測試失敗：頻道刪除失敗")
        else:
            print(f"❌ 測試失敗：HTTP 錯誤 {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("❌ 無法連接到 Discord bot (localhost:5001)")
        print("💡 請確保 Discord bot 正在運行")
    except requests.exceptions.Timeout:
        print("❌ 請求超時")
    except Exception as e:
        print(f"❌ 測試時發生錯誤: {e}")

if __name__ == "__main__":
    asyncio.run(test_discord_delete())
