import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
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
  source: string;
  createdAt: string;
  expiresAt: string;
  amount: number;
  balance: number;
  enabled: boolean;
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
      title: '使用详情',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '使用时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => (text ? dayjs(text).format('YYYY.MM.DD HH:mm:ss') : ''),
    },
    {
      title: '积分变更',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (amount) => `${amount > 0 ? '+' : ''}${amount.toLocaleString()}`,
    },
  ];

  // Columns for Recharge History Table
  const rechargeColumns: ColumnsType<CreditRechargeRecord> = [
    {
      title: '获取途径',
      dataIndex: 'source',
      key: 'source',
      render: (source) => {
        const sourceMap: Record<string, string> = {
          purchase: '购买',
          gift: '赠送',
          promotion: '促销',
          refund: '退款',
        };
        return sourceMap[source] || source;
      },
    },
    {
      title: '获取时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text) => (text ? dayjs(text).format('YYYY.MM.DD HH:mm:ss') : ''),
    },
    {
      title: '有效期至',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (text) => (text ? dayjs(text).format('YYYY.MM.DD') : '-'),
    },
    {
      title: '积分变更',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (amount) => `${amount > 0 ? '+' : ''}${amount.toLocaleString()}`,
    },
    {
      title: '剩余',
      dataIndex: 'balance',
      key: 'balance',
      align: 'right',
      render: (balance) => balance.toLocaleString(),
    },
    {
      title: '状态',
      key: 'status',
      align: 'right',
      render: (_, record) => {
        if (!record.enabled) {
          return '已禁用';
        }
        if (record.balance <= 0) {
          return '已用尽';
        }
        const now = new Date();
        const expiryDate = new Date(record.expiresAt);
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
    <div className={`subscription-plan-card plan-${planType} w-full`}>
      <div className="plan-info w-full">
        <div className="current-plan-label">当前订阅方案</div>
        <div className="current-plan-name flex items-center w-full justify-between">
          {displayName} {planDisplayNameMap[planType as keyof typeof planDisplayNameMap]}
          <div className="flex items-center gap-3 plan-actions">
            <div className="plan-renewal-info text-[color:var(--text-icon-refly-text-0,#1C1F23)] text-xs font-normal leading-4">
              {`${currentPeriodEnd ? dayjs(currentPeriodEnd).format('YYYY.MM.DD') : ''} ${willCancelAtPeriodEnd ? '到期' : '将自动续订'}`}
            </div>
            <div
              className="cursor-pointer text-sm font-semibold leading-5 flex h-[var(--height-button\_default,32px)] [padding:var(--spacing-button\_default-paddingTop,6px)_var(--spacing-button\_default-paddingRight,12px)_var(--spacing-button\_default-paddingTop,6px)_var(--spacing-button\_default-paddingLeft,12px)] justify-center items-center border-[color:var(--border---refly-Card-Border,rgba(0,0,0,0.10))] [background:var(--tertiary---refly-tertiary-default,rgba(0,0,0,0.04))] rounded-lg border-0 border-solid"
              onClick={handleManageBilling}
            >
              查看账单
            </div>
            <Button
              type="primary"
              className="ant-btn-primary"
              onClick={() => {
                setShowSettingModal(false);
                setSubscribeModalVisible(true);
              }}
            >
              变更套餐
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  const FreePlanCard = () => (
    <div className="subscription-plan-card plan-free w-full">
      <div className="plan-info w-full">
        <div className="current-plan-label">当前订阅方案</div>
        <div className="current-plan-name flex items-center w-full justify-between">
          {displaySubscription?.displayName?.split(' ')[0] || 'Free'} 免费版
          <Button
            type="primary"
            className="upgrade-button ant-btn-primary"
            onClick={() => {
              setShowSettingModal(false);
              setSubscribeModalVisible(true);
            }}
          >
            升级套餐
          </Button>
        </div>
      </div>
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
                  {storageUsage?.fileCountUsed || 0}{' '}
                  <span style={{ color: 'rgba(28, 31, 35, 0.5)' }}>
                    / {storageUsage?.fileCountQuota < 0 ? '∞' : storageUsage?.fileCountQuota}
                  </span>
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
                  bordered={false}
                />
              </Spin>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
