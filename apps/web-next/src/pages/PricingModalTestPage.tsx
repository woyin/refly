import React, { useState, useCallback } from 'react';
import PricingModalPage from './PricingModalPage';

const PricingModalTestPage: React.FC = React.memo(() => {
  const [showModal, setShowModal] = useState(false);

  const openModal = useCallback(() => {
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return (
    <div className="min-h-screen bg-refly-bg-body-z0 flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-8">
        <h1 className="text-4xl font-bold text-refly-text-0 mb-4">定价模态框测试页面</h1>

        <p className="text-lg text-refly-text-2 mb-8 max-w-2xl">
          这是一个用于测试定价模态框的页面。点击下方按钮来查看完全还原的定价模态框界面。
        </p>

        <div className="space-y-4">
          <button
            type="button"
            onClick={openModal}
            className="bg-refly-primary-default hover:bg-refly-primary-hover text-white font-medium py-4 px-8 rounded-lg transition-colors text-lg"
          >
            打开定价模态框
          </button>

          <div className="text-sm text-refly-text-3 space-y-2">
            <p>• 支持按月/按年切换</p>
            <p>• 动态显示 "省额 20%" 标签</p>
            <p>• Starter套餐有 "最受欢迎" 标签</p>
            <p>• 完全响应式设计</p>
            <p>• 使用项目配置的CSS变量</p>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50">
          <PricingModalPage />
          {/* Override close button to control from parent */}
          <button
            type="button"
            onClick={closeModal}
            className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-refly-fill-default hover:bg-refly-fill-hover transition-colors z-[60]"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path
                d="M12 4L4 12M4 4L12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
});

PricingModalTestPage.displayName = 'PricingModalTestPage';

export default PricingModalTestPage;
