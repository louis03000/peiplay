'use client'

import { useState, useEffect } from 'react'
import { 
  XMarkIcon, 
  UserIcon, 
  ClockIcon, 
  ChatBubbleLeftRightIcon, 
  ExclamationCircleIcon, 
  StarIcon,
  Squares2X2Icon
} from '@heroicons/react/24/outline'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete: () => void
}

const STEPS = [
  {
    id: 1,
    title: '選擇服務模式',
    icon: Squares2X2Icon,
    content: [
      '一般預約：提前預約時段，穩定可靠',
      '即時預約：立即開始，快速配對',
      '多人陪玩：邀請好友一起遊戲',
      '群組預約：加入或創建群組預約'
    ],
    showServiceTypes: true
  },
  {
    id: 2,
    title: '選擇陪玩師',
    icon: UserIcon,
    content: [
      '查看擅長遊戲、價格與評價',
      '選擇最適合您的陪玩師'
    ]
  },
  {
    id: 3,
    title: '選擇時段',
    icon: ClockIcon,
    content: [
      '單人 / 多人陪玩',
      '注意時段是否重疊'
    ]
  },
  {
    id: 4,
    title: 'Discord 頻道即代表服務開始',
    icon: ChatBubbleLeftRightIcon,
    content: [
      'Discord 頻道建立後即視為服務開始',
      '服務開始後不可部分退款'
    ],
    isImportant: true
  },
  {
    id: 5,
    title: '取消與退款規則',
    icon: ExclamationCircleIcon,
    content: [
      '需於指定時間內取消',
      '逾時將無法退款'
    ]
  },
  {
    id: 6,
    title: '完成後可留下評價',
    icon: StarIcon,
    content: [
      '評價有助於改善配對品質',
      '幫助其他使用者選擇'
    ]
  }
]

export default function OnboardingModal({ isOpen, onClose, onComplete }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  // 重置步驟當 modal 打開時
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0)
      setDontShowAgain(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const step = STEPS[currentStep]
  const Icon = step.icon
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === STEPS.length - 1

  const handleNext = () => {
    if (isLastStep) {
      handleComplete()
    } else {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    if (dontShowAgain) {
      localStorage.setItem('peiplay_onboarding_done', 'true')
    }
    onComplete()
  }

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('peiplay_onboarding_done', 'true')
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 半透明遮罩 */}
      <div 
        className="absolute inset-0 bg-black opacity-50"
        onClick={handleClose}
      />
      
      {/* Modal 內容 */}
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-[520px] sm:max-w-[420px] mx-4 transform transition-all duration-200 scale-100 opacity-100">
        {/* 關閉按鈕 */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
          aria-label="關閉"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        {/* 內容區域 */}
        <div className="p-6 sm:p-8">
          {/* 進度指示器 */}
          <div className="flex justify-center gap-2 mb-6">
            {STEPS.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentStep
                    ? 'bg-indigo-600 w-6'
                    : index < currentStep
                    ? 'bg-indigo-300'
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>

          {/* Step 內容 */}
          <div className="text-center mb-8">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              step.isImportant ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'
            }`}>
              <Icon className="w-8 h-8" />
            </div>
            
            <h2 className={`text-2xl font-bold mb-4 ${
              step.isImportant ? 'text-red-600' : 'text-gray-900'
            }`}>
              {step.title}
            </h2>
            
            {step.showServiceTypes ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-left">
                  <div className="font-semibold text-blue-900 mb-1">一般預約</div>
                  <div className="text-sm text-blue-700">提前預約時段，穩定可靠</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-left">
                  <div className="font-semibold text-green-900 mb-1">即時預約</div>
                  <div className="text-sm text-green-700">立即開始，快速配對</div>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-left">
                  <div className="font-semibold text-purple-900 mb-1">多人陪玩</div>
                  <div className="text-sm text-purple-700">邀請好友一起遊戲</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-left">
                  <div className="font-semibold text-orange-900 mb-1">群組預約</div>
                  <div className="text-sm text-orange-700">加入或創建群組預約</div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-gray-700">
                {step.content.map((line, index) => (
                  <p key={index} className="text-base leading-relaxed">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* 底部操作區 */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-gray-200">
            {/* 左側：上一步按鈕 */}
            <button
              onClick={handlePrevious}
              disabled={isFirstStep}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isFirstStep
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              上一步
            </button>

            {/* 中間：不再顯示勾選框 */}
            <label className="flex items-center gap-2 cursor-pointer order-3 sm:order-2">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-600 whitespace-nowrap">
                下次不再顯示此教學
              </span>
            </label>

            {/* 右側：下一步/完成按鈕 */}
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors order-2 sm:order-3"
            >
              {isLastStep ? '我知道了' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// 導出一個函數，用於手動打開 onboarding（供幫助中心等使用）
export function openOnboarding() {
  // 這個函數可以通過事件或全局狀態來觸發
  // 實際使用時可以通過 Context 或全局狀態管理
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-onboarding'))
  }
}
