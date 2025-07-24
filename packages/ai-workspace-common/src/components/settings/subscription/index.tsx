import { useEffect, useState } from 'react';
import { Button, Typography, Table, Segmented } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';

import {
  useSubscriptionStoreShallow,
  useUserStoreShallow,
  useSiderStoreShallow,
} from '@refly/stores';
import {
  useGetCreditBalance,
  useGetCreditUsage,
  useGetCreditRecharge,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { useSubscriptionUsage } from '@refly-packages/ai-workspace-common/hooks/use-subscription-usage';
import { formatDate } from '@refly-packages/ai-workspace-common/utils/date';

// styles
import './index.scss';

const { Title } = Typography;

// Define interfaces for the table data
interface CreditUsageRecord {
  usageId: string;
  description?: string;
  createdAt: string;
  amount: number;
}

interface CreditRechargeRecord {
  rechargeId: string;
  description?: string;
  createdAt: string;
  expiredAt: string;
  amount: number;
  balance: number;
}

export const Subscription = () => {
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));
  const { subscription } = userProfile ?? {};

  const { setSubscribeModalVisible, setPlanType } = useSubscriptionStoreShallow((state) => ({
    setSubscribeModalVisible: state.setSubscribeModalVisible,
    setPlanType: state.setPlanType,
  }));

  const { setShowSettingModal } = useSiderStoreShallow((state) => ({
    setShowSettingModal: state.setShowSettingModal,
  }));

  const { isUsageLoading: isStorageUsageLoading, storageUsage } = useSubscriptionUsage();

  // Fetch credit balance
  const { data: balanceData, isLoading: isBalanceLoading } = useGetCreditBalance();
  const creditBalance = balanceData?.data?.creditBalance ?? 0;

  // State for active history tab
  const [activeTab, setActiveTab] = useState<'usage' | 'recharge'>('usage');

  // Fetch credit history data
  const { data: usageData, isLoading: isUsageHistoryLoading } = useGetCreditUsage({
    enabled: activeTab === 'usage',
  });
  const { data: rechargeData, isLoading: isRechargeHistoryLoading } = useGetCreditRecharge({
    enabled: activeTab === 'recharge',
  });

  const isHistoryLoading = isUsageHistoryLoading || isRechargeHistoryLoading;

  useEffect(() => {
    setPlanType(subscription?.planType || 'free');
  }, [subscription?.planType, setPlanType]);

  // Columns for Usage History Table
  const usageColumns: ColumnsType<CreditUsageRecord> = [
    {
      title: '使用详情',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || 'N/A',
    },
    {
      title: '使用时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => formatDate(text),
    },
    {
      title: '积分变更',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => {
        if (amount > 0) {
          return <span style={{ color: '#52c41a' }}>{`+${amount}`}</span>;
        }
        // For negative values, the number itself will have the minus sign
        return <span>{amount}</span>;
      },
    },
  ];

  // Columns for Recharge History Table
  const rechargeColumns: ColumnsType<CreditRechargeRecord> = [
    {
      title: '获取途径',
      dataIndex: 'description',
      key: 'description',
      render: (text) => text || 'N/A',
    },
    {
      title: '获取时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => formatDate(text),
    },
    {
      title: '有效期至',
      dataIndex: 'expiredAt',
      key: 'expiredAt',
      render: (text) => formatDate(text),
    },
    {
      title: '积分变更',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => <span style={{ color: '#52c41a' }}>{`+${amount}`}</span>,
    },
    {
      title: '剩余',
      dataIndex: 'balance',
      key: 'balance',
    },
    {
      title: '状态',
      key: 'status',
      render: (_, record) => {
        const now = new Date();
        const expiryDate = new Date(record.expiredAt);
        if (record.balance <= 0) {
          return <span style={{ color: 'rgba(0, 0, 0, 0.45)' }}>已用尽</span>;
        }
        if (expiryDate < now) {
          return <span style={{ color: 'rgba(0, 0, 0, 0.45)' }}>已失效</span>;
        }
        return <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>可用</span>;
      },
    },
  ];

  const isLoading = isStorageUsageLoading || isBalanceLoading;

  return (
    <div className="subscription-management-page">
      <div className="subscription-header">
        <Title level={4} className="title">
          订阅管理
        </Title>
        <div className="subtitle">管理订阅方案与积分</div>
      </div>

      <div className="subscription-content">
        {isLoading ? (
          <Spin
            spinning={isLoading}
            style={{
              height: '100%',
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        ) : (
          <>
            <div className="subscription-plan-card">
              <div className="plan-info">
                <div className="current-plan-label">当前订阅方案</div>
                <div className="current-plan-name">{subscription?.planType || 'Free'} 免费版</div>
              </div>
              <Button
                type="primary"
                className="upgrade-button"
                onClick={() => {
                  setShowSettingModal(false);
                  setSubscribeModalVisible(true);
                }}
              >
                升级套餐
              </Button>
            </div>

            <div className="usage-cards">
              <div className="usage-card points-card">
                <div className="usage-label">剩余可用积分</div>
                <div className="usage-value">{creditBalance.toLocaleString()}</div>
              </div>
              <div className="usage-card files-card">
                <div className="usage-label">知识库文件</div>
                <div className="usage-value">
                  {`${storageUsage?.fileCountUsed || 0} / ${storageUsage?.fileCountQuota < 0 ? '∞' : storageUsage?.fileCountQuota}`}
                </div>
              </div>
            </div>

            <div className="points-history">
              <Segmented
                options={[
                  { label: '积分使用明细', value: 'usage' },
                  { label: '积分获取明细', value: 'recharge' },
                ]}
                value={activeTab}
                onChange={(value) => setActiveTab(value as 'usage' | 'recharge')}
                className="history-tabs"
                size="large"
              />
              <Spin spinning={isHistoryLoading}>
                <Table<any>
                  columns={activeTab === 'usage' ? usageColumns : rechargeColumns}
                  dataSource={
                    activeTab === 'usage' ? usageData?.data || [] : rechargeData?.data || []
                  }
                  rowKey={activeTab === 'usage' ? 'usageId' : 'rechargeId'}
                  pagination={{ showSizeChanger: false }}
                  className="history-table"
                />
              </Spin>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
