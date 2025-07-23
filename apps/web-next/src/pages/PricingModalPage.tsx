import React, { useState, useCallback, useMemo } from 'react';

interface PricingPlan {
  id: string;
  name: string;
  title: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
  };
  originalPrice?: {
    monthly: number;
    yearly: number;
  };
  features: string[];
  buttonText: string;
  buttonVariant: 'primary' | 'secondary' | 'contact';
  isPopular?: boolean;
  isFree?: boolean;
}

interface PricingModalPageProps {
  onClose?: () => void;
}

const PricingModalPage: React.FC<PricingModalPageProps> = React.memo(({ onClose }) => {
  const [isYearly, setIsYearly] = useState(false);

  const plans: PricingPlan[] = useMemo(
    () => [
      {
        id: 'free',
        name: 'Free',
        title: '当前套餐',
        description: '开启创意之旅的完美起点',
        price: { monthly: 0, yearly: 0 },
        features: [
          '每日可获得新积分',
          '100 点',
          '世界顶级AI模型',
          'OpenAI、Claude、Grok、DeepSeek...',
          '知识库文档',
          '100 个',
          '文件上传限制',
          '最大 5MB',
          '服务支持',
          '社区支持（微信群、飞书群、Discord）',
        ],
        buttonText: '继续免费使用',
        buttonVariant: 'secondary',
        isFree: true,
      },
      {
        id: 'starter',
        name: 'Starter',
        title: '启程版',
        description: '轻量探索者的理想选择',
        price: { monthly: 24.9, yearly: 19.9 },
        originalPrice: { monthly: 24.9, yearly: 238.8 },
        features: [
          '每日可获得新积分',
          '300 点',
          '每月积分',
          '2000 点',
          '世界顶级AI模型',
          'OpenAI、Claude、Grok、DeepSeek...',
          '知识库文档',
          '200 个',
          '文件上传限制',
          '最大 10MB',
          '服务支持',
          '高优邮件支持',
        ],
        buttonText: '升级到 Starter',
        buttonVariant: 'primary',
        isPopular: true,
      },
      {
        id: 'maker',
        name: 'Maker',
        title: '创作版',
        description: '进阶创作者的高性能首选',
        price: { monthly: 49.9, yearly: 39.9 },
        originalPrice: { monthly: 49.9, yearly: 478.8 },
        features: [
          '每日可获得新积分',
          '300 点',
          '每月积分',
          '4000 点',
          '世界顶级AI模型',
          'OpenAI、Claude、Grok、DeepSeek...',
          '知识库文档',
          '500 个',
          '文件上传限制',
          '最大 20MB',
          '服务支持',
          '高优邮件支持',
        ],
        buttonText: '升级到 Maker',
        buttonVariant: 'secondary',
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        title: '企业版',
        description: '专为企业打造的 AI 工作台',
        price: { monthly: 0, yearly: 0 },
        features: [
          '每月享有更多的积分',
          '可视化 Canvas + 节点',
          '多模型集成 + 智能检索',
          '知识库深度连接',
          '模板与节点共享',
          '更多企业级能力敬请期待',
        ],
        buttonText: '联系销售咨询',
        buttonVariant: 'contact',
      },
    ],
    [],
  );

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handlePlanSelect = useCallback((planId: string) => {
    console.log('Selected plan:', planId);
  }, []);

  const renderFeatureList = useCallback((features: string[]) => {
    const items = [];
    for (let i = 0; i < features.length; i += 2) {
      const label = features[i];
      const value = features[i + 1];
      if (label) {
        items.push(
          <div key={i} className="flex items-start gap-2.5 mb-3">
            <div className="w-4 h-4 mt-0.5 flex-shrink-0">
              <svg viewBox="0 0 16 16" fill="none" className="w-full h-full">
                <path
                  d="M13.5 4.5L6 12L2.5 8.5"
                  stroke="#12B76A"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 leading-tight">{label}</div>
              {value && <div className="text-sm text-gray-600 leading-tight">{value}</div>}
            </div>
          </div>,
        );
      }
    }
    return items;
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-7xl mx-6 max-h-[95vh] overflow-y-auto">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors z-10"
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

        {/* Header */}
        <div className="text-center pt-16 pb-12 px-12">
          <h1 className="text-3xl font-semibold text-gray-900 mb-10">升级套餐获得更多积分</h1>

          {/* Billing Toggle */}
          <div className="inline-flex items-center border border-gray-200 rounded-lg p-1 bg-gray-50">
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                !isYearly
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              按月
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all relative ${
                isYearly
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              按年
              {isYearly && (
                <span className="absolute -top-2 -right-1 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-medium text-[10px]">
                  省额 20%
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Popular Badge for Starter - Positioned Above Cards */}
        <div className="relative px-12">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 translate-x-[25%] z-10">
            <span className="bg-green-600 text-white text-sm font-medium px-4 py-1.5 rounded-full">
              最受欢迎
            </span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="px-12 pb-12 pt-8">
          <div className="grid grid-cols-4 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl p-6 transition-all ${
                  plan.isPopular
                    ? 'border-2 border-green-600 shadow-lg'
                    : 'border border-gray-200 shadow-sm hover:shadow-md'
                }`}
              >
                {/* Plan Header */}
                <div className="text-center mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                    {plan.isFree && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                        {plan.title}
                      </span>
                    )}
                  </div>

                  {!plan.isFree && <p className="text-sm text-gray-600 mb-2">{plan.title}</p>}

                  <p className="text-sm text-gray-500 mb-6">{plan.description}</p>

                  {/* Pricing */}
                  <div className="mb-8">
                    {plan.isFree ? (
                      <div className="text-3xl font-bold text-gray-900">永久免费</div>
                    ) : plan.id === 'enterprise' ? (
                      <div className="py-6" />
                    ) : (
                      <div>
                        <div className="text-3xl font-bold text-gray-900 mb-1">
                          $ {isYearly ? plan.price.yearly : plan.price.monthly}
                          {isYearly ? '/年' : '/月'}
                        </div>
                        {isYearly && plan.originalPrice && (
                          <div className="text-sm text-gray-500">
                            $ {plan.originalPrice.yearly}/年 省额 20%
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Button */}
                <div className="mb-8">
                  {plan.buttonVariant === 'primary' ? (
                    <button
                      type="button"
                      onClick={() => handlePlanSelect(plan.id)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      {plan.buttonText}
                    </button>
                  ) : plan.buttonVariant === 'contact' ? (
                    <button
                      type="button"
                      onClick={() => handlePlanSelect(plan.id)}
                      className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      {plan.buttonText}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePlanSelect(plan.id)}
                      className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                      {plan.buttonText}
                    </button>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-3">{renderFeatureList(plan.features)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-8 px-8">
          <p className="text-sm text-gray-500">
            可随时取消订阅，订阅即表示同意Refly的{' '}
            <span className="text-blue-600 cursor-pointer hover:underline">服务条款</span> 和{' '}
            <span className="text-blue-600 cursor-pointer hover:underline">条款</span>
          </p>
        </div>
      </div>
    </div>
  );
});

PricingModalPage.displayName = 'PricingModalPage';

export default PricingModalPage;
