import React from 'react';
import { Card, Statistic, Alert, Spin } from 'antd';
import { WalletOutlined, CreditCardOutlined } from '@ant-design/icons';
import { useGetCreditBalance } from '@refly-packages/ai-workspace-common/queries/queries';

/**
 * Credit Balance Component
 * 显示用户当前的积分余额信息
 */
const CreditBalance: React.FC = () => {
  const { data, isLoading, error } = useGetCreditBalance();

  if (isLoading) {
    return (
      <Card title="积分余额" className="mb-6">
        <div className="flex justify-center items-center h-32">
          <Spin size="large" tip="加载中..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="积分余额" className="mb-6">
        <Alert
          message="加载失败"
          description="无法获取积分余额信息，请稍后重试"
          type="error"
          showIcon
        />
      </Card>
    );
  }

  const creditBalance = data?.data?.creditBalance ?? 0;
  const creditAmount = data?.data?.creditAmount ?? 0;

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <WalletOutlined className="text-blue-500" />
          <span>积分余额</span>
        </div>
      }
      className="mb-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Statistic
          title="可用积分"
          value={creditBalance}
          precision={0}
          valueStyle={{ color: '#3f8600' }}
          prefix={<CreditCardOutlined />}
          suffix="积分"
        />
        <Statistic
          title="总充值积分"
          value={creditAmount}
          precision={0}
          valueStyle={{ color: '#1677ff' }}
          prefix={<CreditCardOutlined />}
          suffix="积分"
        />
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 mb-2">积分说明</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 可用积分：当前可以使用的积分数量</li>
          <li>• 总充值积分：历史累计充值的积分总额</li>
          <li>• 积分用于AI技能调用、媒体生成等功能</li>
          <li>• 积分充值后有效期为30天</li>
        </ul>
      </div>
    </Card>
  );
};

export default CreditBalance;
