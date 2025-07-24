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

// styles
import './index.scss';

const { Title } = Typography;

// --- Test Data for Development ---
const mockSubscriptions = {
  free: {
    planType: 'free',
    isPaid: false,
    displayName: 'Free Plan',
  },
  starter: {
    planType: 'starter',
    isPaid: true,
    displayName: 'Starter',
    stripePortalUrl: '#',
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    willCancelAtPeriodEnd: false,
  },
  maker_active: {
    planType: 'maker',
    isPaid: true,
    displayName: 'Maker',
    stripePortalUrl: '#',
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    willCancelAtPeriodEnd: false,
  },
  maker_canceling: {
    planType: 'maker',
    isPaid: true,
    displayName: 'Maker',
    stripePortalUrl: '#',
    currentPeriodEnd: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days from now
    willCancelAtPeriodEnd: true,
  },
};

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

  // State to hold the subscription data for display, defaults to real data
  const [displaySubscription, setDisplaySubscription] = useState(userProfile?.subscription);

  // Update display subscription when real subscription data changes
  useEffect(() => {
    setDisplaySubscription(userProfile?.subscription);
  }, [userProfile?.subscription]);

  const handleTestPlanChange = (value: string) => {
    if (value === 'real') {
      setDisplaySubscription(userProfile?.subscription);
    } else {
      // @ts-ignore
      setDisplaySubscription(mockSubscriptions[value]);
    }
  };

  const {
    isPaid,
    displayName,
    stripePortalUrl,
    currentPeriodEnd,
    willCancelAtPeriodEnd,
    planType,
  } = displaySubscription ?? {};

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

  const isLoading = isStorageUsageLoading || isBalanceLoading;

  // State for active history tab
  const [activeTab, setActiveTab] = useState<'usage' | 'recharge'>('usage');

  // Fetch credit history data
  const { data: usageData, isLoading: isUsageHistoryLoading } = useGetCreditUsage(
    {},
    [],
    // @ts-ignore
    { enabled: activeTab === 'usage' },
  );
  const { data: rechargeData, isLoading: isRechargeHistoryLoading } = useGetCreditRecharge(
    {},
    [],
    // @ts-ignore
    { enabled: activeTab === 'recharge' },
  );

  const isHistoryLoading = isUsageHistoryLoading || isRechargeHistoryLoading;

  useEffect(() => {
    setPlanType(displaySubscription?.planType || 'free');
  }, [displaySubscription?.planType, setPlanType]);

  const handleManageBilling = () => {
    if (stripePortalUrl) {
      window.open(stripePortalUrl, '_blank');
    }
  };

  // Columns for Usage History Table
  const usageColumns: ColumnsType<CreditUsageRecord> = [
    {
      title: '使用说明',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '使用时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '积分变更',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => <span style={{ color: '#F5222D' }}>{`-${amount.toLocaleString()}`}</span>,
    },
  ];

  // Columns for Recharge History Table
  const rechargeColumns: ColumnsType<CreditRechargeRecord> = [
    {
      title: '获取说明',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '获取时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '积分变更',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount) => <span style={{ color: '#52C41A' }}>{`+${amount.toLocaleString()}`}</span>,
    },
    {
      title: '当时总额',
      dataIndex: 'balance',
      key: 'balance',
      render: (_, record) => <span>{(record.amount + record.balance).toLocaleString()}</span>,
    },
    {
      title: '有效期至',
      dataIndex: 'expiredAt',
      key: 'expiredAt',
      render: (text) => (text ? text : '-'),
    },
    {
      title: '状态',
      key: 'status',
      align: 'right',
      render: (_, record) => {
        const now = new Date();
        const expiryDate = new Date(record.expiredAt);
        if (record.balance <= 0) {
          return '已用尽';
        }
        if (expiryDate < now) {
          return '已失效';
        }
        return '可用';
      },
    },
  ];

  const planDisplayNameMap = {
    starter: '启程版',
    maker: '创造者版',
  };

  const PaidPlanCard = () => (
    <div className={`subscription-plan-card plan-${planType}`}>
      <div className="plan-info">
        <div className="current-plan-label">当前订阅方案</div>
        <div className="current-plan-name">
          {displayName} {planDisplayNameMap[planType as keyof typeof planDisplayNameMap]}
        </div>
      </div>
      <div className="plan-actions">
        <div className="plan-renewal-info">
          {`${currentPeriodEnd ? currentPeriodEnd.split('T')[0].replace(/-/g, '.') : ''} ${willCancelAtPeriodEnd ? '到期' : '将自动续订'}`}
        </div>
        <Button type="default" onClick={handleManageBilling}>
          查看账单
        </Button>
        <Button
          type="primary"
          onClick={() => {
            setShowSettingModal(false);
            setSubscribeModalVisible(true);
          }}
        >
          变更套餐
        </Button>
      </div>
    </div>
  );

  const FreePlanCard = () => (
    <div className="subscription-plan-card plan-free">
      <div className="plan-info">
        <div className="current-plan-label">当前订阅方案</div>
        <div className="current-plan-name">
          {displaySubscription?.displayName?.split(' ')[0] || 'Free'} 免费版
        </div>
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
  );

  return (
    <div className="subscription-management-page">
      {/* --- Development Test Harness -- */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ padding: '0 16px 16px', border: '1px dashed #ccc', margin: '0 16px 16px' }}>
          <Title level={5} style={{ marginTop: '16px' }}>
            🧪 Test Controls
          </Title>
          <Segmented
            options={[
              { label: 'Real Data', value: 'real' },
              { label: 'Free', value: 'free' },
              { label: 'Starter', value: 'starter' },
              { label: 'Maker (Active)', value: 'maker_active' },
              { label: 'Maker (Canceling)', value: 'maker_canceling' },
            ]}
            onChange={handleTestPlanChange}
          />
        </div>
      )}
      {/* --- End Test Harness -- */}
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
            {isPaid ? <PaidPlanCard /> : <FreePlanCard />}

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
