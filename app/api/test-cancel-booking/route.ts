import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 })
    }

    // 獲取用戶的預約
    const bookings = await prisma.booking.findMany({
      where: {
        customer: {
          userId: session.user.id
        }
      },
      include: {
        schedule: {
          include: {
            partner: true
          }
        },
        customer: {
          include: {
            user: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    })

    const testHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>取消預約測試</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .booking { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
          .status { padding: 4px 8px; border-radius: 4px; color: white; font-size: 12px; }
          .pending { background: #f59e0b; }
          .pending-payment { background: #ea580c; }
          .confirmed { background: #10b981; }
          .cancelled { background: #ef4444; }
          .completed { background: #3b82f6; }
          .rejected { background: #dc2626; }
          .cancel-btn { background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; }
          .cancel-btn:hover { background: #dc2626; }
          .cancel-btn:disabled { background: #9ca3af; cursor: not-allowed; }
          .info { background: #e7f3ff; padding: 10px; border-radius: 4px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔧 取消預約功能測試</h1>
          
          <div class="info">
            <strong>測試說明：</strong> 此頁面顯示您的最近 5 筆預約，並測試取消功能是否正常工作
          </div>
          
          <h2>您的預約列表</h2>
          
          ${bookings.length === 0 ? '<p>沒有找到預約記錄</p>' : bookings.map(booking => {
            const now = new Date()
            const bookingStartTime = new Date(booking.schedule.startTime)
            const hoursUntilBooking = (bookingStartTime.getTime() - now.getTime()) / (1000 * 60 * 60)
            const canCancel = booking.status !== 'CANCELLED' && 
                            booking.status !== 'COMPLETED' && 
                            booking.status !== 'REJECTED' && 
                            hoursUntilBooking >= 2
            
            const getStatusClass = (status: string) => {
              switch(status) {
                case 'PENDING': return 'pending'
                case 'PENDING_PAYMENT': return 'pending-payment'
                case 'CONFIRMED': return 'confirmed'
                case 'CANCELLED': return 'cancelled'
                case 'COMPLETED': return 'completed'
                case 'REJECTED': return 'rejected'
                default: return 'pending'
              }
            }
            
            const getStatusText = (status: string) => {
              switch(status) {
                case 'PENDING': return '待確認'
                case 'PENDING_PAYMENT': return '待付款'
                case 'CONFIRMED': return '已確認'
                case 'CANCELLED': return '已取消'
                case 'COMPLETED': return '已完成'
                case 'REJECTED': return '已拒絕'
                default: return status
              }
            }
            
            return `
              <div class="booking">
                <h3>預約 ID: ${booking.id}</h3>
                <p><strong>夥伴:</strong> ${booking.schedule.partner.name}</p>
                <p><strong>日期:</strong> ${new Date(booking.schedule.startTime).toLocaleDateString('zh-TW')}</p>
                <p><strong>時間:</strong> ${new Date(booking.schedule.startTime).toLocaleTimeString('zh-TW')} - ${new Date(booking.schedule.endTime).toLocaleTimeString('zh-TW')}</p>
                <p><strong>狀態:</strong> <span class="status ${getStatusClass(booking.status)}">${getStatusText(booking.status)}</span></p>
                <p><strong>建立時間:</strong> ${new Date(booking.createdAt).toLocaleString('zh-TW')}</p>
                <p><strong>距離預約時間:</strong> ${hoursUntilBooking.toFixed(1)} 小時</p>
                <p><strong>可取消:</strong> ${canCancel ? '是' : '否'}</p>
                ${booking.orderNumber ? `<p><strong>訂單編號:</strong> ${booking.orderNumber}</p>` : ''}
                ${booking.paymentError ? `<p><strong>付款錯誤:</strong> ${booking.paymentError}</p>` : ''}
                
                ${canCancel ? `
                  <button 
                    class="cancel-btn" 
                    onclick="cancelBooking('${booking.id}')"
                    id="cancel-${booking.id}"
                  >
                    取消預約
                  </button>
                ` : '<p style="color: #6b7280;">此預約無法取消</p>'}
              </div>
            `
          }).join('')}
          
          <div class="info">
            <strong>注意：</strong> 
            <ul>
              <li>只有狀態為「待確認」、「待付款」或「已確認」的預約可以取消</li>
              <li>距離預約時間少於 2 小時的預約無法取消</li>
              <li>已取消、已完成或已拒絕的預約無法再次取消</li>
            </ul>
          </div>
        </div>
        
        <script>
          async function cancelBooking(bookingId) {
            if (!confirm('確定要取消這個預約嗎？取消後無法復原。')) {
              return
            }
            
            const button = document.getElementById('cancel-' + bookingId)
            button.disabled = true
            button.textContent = '取消中...'
            
            try {
              const response = await fetch('/api/bookings/' + bookingId + '/cancel', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
              })
              
              const data = await response.json()
              
              if (response.ok) {
                alert('預約已成功取消！')
                location.reload()
              } else {
                alert(data.error || '取消預約失敗')
                button.disabled = false
                button.textContent = '取消預約'
              }
            } catch (error) {
              alert('取消預約時發生錯誤，請稍後再試')
              button.disabled = false
              button.textContent = '取消預約'
            }
          }
        </script>
      </body>
      </html>
    `

    return new NextResponse(testHtml, {
      headers: {
        'Content-Type': 'text/html',
      },
    })

  } catch (error) {
    console.error('Test cancel booking error:', error)
    return NextResponse.json(
      { error: '測試失敗' },
      { status: 500 }
    )
  }
}
