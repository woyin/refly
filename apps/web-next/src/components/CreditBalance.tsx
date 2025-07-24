import React from 'react';
import { Card, Statistic, Alert, Spin, Button, Collapse, Table } from 'antd';
import {
  WalletOutlined,
  CreditCardOutlined,
  ReloadOutlined,
  UserOutlined,
  CalculatorOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useGetCreditBalance,
  useGetCreditRecharge,
} from '@refly-packages/ai-workspace-common/queries/queries';
import { useMockUser } from '../hooks/useMockUser';

const { Panel } = Collapse;

/**
 * Credit Balance Component
 * 显示用户当前的积分余额信息，包含详细的计算过程
 */
const CreditBalance: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, isMockMode } = useMockUser();
  const {
    data: balanceData,
    isLoading: balanceLoading,
    error: balanceError,
    refetch: refetchBalance,
  } = useGetCreditBalance();
  const {
    data: rechargeData,
    isLoading: rechargeLoading,
    error: rechargeError,
    refetch: refetchRecharge,
  } = useGetCreditRecharge();

  const isLoading = balanceLoading || rechargeLoading;
  const error = balanceError || rechargeError;

  if (isLoading) {
    return (
      <Card title={t('credit.balance.title')} className="mb-6">
        <div className="flex justify-center items-center h-32">
          <Spin size="large" tip={t('common.loading')} />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title={t('credit.balance.title')} className="mb-6">
        <Alert
          message={t('credit.balance.loadFailed')}
          description={t('credit.balance.loadFailedDesc')}
          type="error"
          showIcon
          action={
            <Button
              type="primary"
              size="small"
              onClick={() => {
                refetchBalance();
                refetchRecharge();
              }}
            >
              {t('common.retry')}
            </Button>
          }
        />
      </Card>
    );
  }

  const creditBalance = balanceData?.data?.creditBalance ?? 0;
  const creditAmount = balanceData?.data?.creditAmount ?? 0;
  const rechargeRecords = rechargeData?.data || [];

  // 计算充值记录的总和以验证数据一致性
  const calculatedAmount = rechargeRecords.reduce((sum, record) => sum + (record.amount || 0), 0);
  const calculatedBalance = rechargeRecords.reduce((sum, record) => sum + (record.balance || 0), 0);
  const isDataConsistent = calculatedAmount === creditAmount && calculatedBalance === creditBalance;

  // 充值记录表格列定义
  const columns = [
    {
      title: t('credit.balance.rechargeId'),
      dataIndex: 'rechargeId',
      key: 'rechargeId',
      render: (id: string) => id.slice(-8),
      width: 100,
    },
    {
      title: t('credit.balance.rechargeAmount'),
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `${amount?.toLocaleString()} ${t('credit.balance.creditsUnit')}`,
      width: 120,
    },
    {
      title: t('credit.balance.remainingBalance'),
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: number) =>
        `${balance?.toLocaleString()} ${t('credit.balance.creditsUnit')}`,
      width: 120,
    },
    {
      title: t('credit.balance.source'),
      dataIndex: 'source',
      key: 'source',
      width: 80,
    },
    {
      title: t('credit.balance.description'),
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: t('credit.balance.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
      width: 100,
    },
  ];

  return (
    <Card
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WalletOutlined className="text-blue-500" />
            <span>{t('credit.balance.title')}</span>
            {!isDataConsistent && (
              <InfoCircleOutlined
                className="text-orange-500"
                title={t('credit.balance.dataInconsistent')}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMockMode && currentUser && (
              <div className="flex items-center gap-2 text-sm">
                <UserOutlined className="text-orange-500" />
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                  {t('credit.balance.mockMode')}: {currentUser.displayName}
                </span>
              </div>
            )}
            <Button
              type="text"
              icon={<ReloadOutlined />}
              size="small"
              onClick={() => {
                refetchBalance();
                refetchRecharge();
              }}
              title={t('credit.balance.refreshData')}
            />
          </div>
        </div>
      }
      className="mb-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Statistic
          title={t('credit.balance.availableCredits')}
          value={creditBalance}
          precision={0}
          valueStyle={{ color: '#3f8600' }}
          prefix={<CreditCardOutlined />}
          suffix={t('credit.balance.creditsUnit')}
        />
        <Statistic
          title={t('credit.balance.totalRechargedCredits')}
          value={creditAmount}
          precision={0}
          valueStyle={{ color: '#1677ff' }}
          prefix={<CreditCardOutlined />}
          suffix={t('credit.balance.creditsUnit')}
        />
      </div>

      {/* 数据一致性状态 */}
      {!isDataConsistent && (
        <Alert
          message={t('credit.balance.dataInconsistentWarning')}
          description={t('credit.balance.dataInconsistentDesc', {
            calculatedAmount,
            creditAmount,
            calculatedBalance,
            creditBalance,
          })}
          type="warning"
          showIcon
          className="mt-4"
        />
      )}

      {/* 计算详情 */}
      <Collapse className="mt-4" ghost>
        <Panel
          header={
            <div className="flex items-center gap-2">
              <CalculatorOutlined className="text-green-600" />
              <span className="font-medium">{t('credit.balance.calculationDetails')}</span>
              <span className="text-xs text-gray-500">
                ({rechargeRecords.length} {t('credit.balance.rechargeRecords')})
              </span>
            </div>
          }
          key="calculation"
        >
          <div className="space-y-4">
            {/* 计算公式说明 */}
            <div className="p-3 bg-green-50 rounded-lg">
              <h4 className="text-sm font-medium text-green-800 mb-2">
                {t('credit.balance.calculationFormula')}
              </h4>
              <div className="text-sm text-green-700 space-y-1">
                <div>
                  • <strong>{t('credit.balance.totalRechargedCredits')}</strong> =
                  Σ(所有充值记录.amount)
                </div>
                <div>
                  • <strong>{t('credit.balance.availableCredits')}</strong> =
                  Σ(所有充值记录.balance)
                </div>
                <div>
                  • <strong>{t('credit.balance.usedCredits')}</strong> ={' '}
                  {t('credit.balance.totalRechargedCredits')} -{' '}
                  {t('credit.balance.availableCredits')}
                </div>
              </div>
            </div>

            {/* 计算过程 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-800 mb-2">
                {t('credit.balance.calculationProcess')}
              </h4>
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  • {t('credit.balance.totalRechargedCredits')} ={' '}
                  {rechargeRecords.map((r) => r.amount).join(' + ')} ={' '}
                  <strong>{calculatedAmount.toLocaleString()}</strong>
                </div>
                <div>
                  • {t('credit.balance.availableCredits')} ={' '}
                  {rechargeRecords.map((r) => r.balance).join(' + ')} ={' '}
                  <strong>{calculatedBalance.toLocaleString()}</strong>
                </div>
                <div>
                  • {t('credit.balance.usedCredits')} = {calculatedAmount.toLocaleString()} -{' '}
                  {calculatedBalance.toLocaleString()} ={' '}
                  <strong>{(calculatedAmount - calculatedBalance).toLocaleString()}</strong>
                </div>
              </div>
            </div>

            {/* 充值记录明细 */}
            <div>
              <h4 className="text-sm font-medium text-gray-800 mb-2">
                {t('credit.balance.rechargeRecordsDetails')}
              </h4>
              <Table
                columns={columns}
                dataSource={rechargeRecords}
                rowKey="rechargeId"
                size="small"
                pagination={false}
                summary={(pageData) => {
                  const totalAmount = pageData.reduce(
                    (sum, record) => sum + (record.amount || 0),
                    0,
                  );
                  const totalBalance = pageData.reduce(
                    (sum, record) => sum + (record.balance || 0),
                    0,
                  );
                  const totalUsed = totalAmount - totalBalance;

                  return (
                    <Table.Summary fixed>
                      <Table.Summary.Row className="bg-blue-50">
                        <Table.Summary.Cell index={0}>
                          <strong>{t('credit.balance.total')}</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1}>
                          <strong className="text-blue-600">
                            {totalAmount.toLocaleString()} {t('credit.balance.creditsUnit')}
                          </strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2}>
                          <strong className="text-green-600">
                            {totalBalance.toLocaleString()} {t('credit.balance.creditsUnit')}
                          </strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3}>
                          <span className="text-orange-600">
                            {t('credit.balance.usedCredits')}: {totalUsed.toLocaleString()}
                          </span>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} colSpan={2}>
                          <span className="text-xs text-gray-500">
                            {t('credit.balance.usageRate')}:{' '}
                            {totalAmount > 0 ? ((totalUsed / totalAmount) * 100).toFixed(1) : 0}%
                          </span>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  );
                }}
              />
            </div>

            {/* 数据验证 */}
            <div className="p-3 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                {t('credit.balance.dataVerification')}
              </h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>{t('credit.balance.apiTotalRechargedCredits')}:</span>
                  <span
                    className={
                      creditAmount === calculatedAmount ? 'text-green-600' : 'text-red-600'
                    }
                  >
                    {creditAmount.toLocaleString()} {creditAmount === calculatedAmount ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('credit.balance.calculatedTotalRechargedCredits')}:</span>
                  <span>{calculatedAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{t('credit.balance.apiAvailableCredits')}:</span>
                  <span
                    className={
                      creditBalance === calculatedBalance ? 'text-green-600' : 'text-red-600'
                    }
                  >
                    {creditBalance.toLocaleString()}{' '}
                    {creditBalance === calculatedBalance ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t('credit.balance.calculatedAvailableCredits')}:</span>
                  <span>{calculatedBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>{t('credit.balance.dataConsistency')}:</span>
                  <span className={isDataConsistent ? 'text-green-600' : 'text-red-600'}>
                    {isDataConsistent
                      ? `✅ ${t('credit.balance.consistent')}`
                      : `❌ ${t('credit.balance.inconsistent')}`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </Collapse>

      {/* 积分说明 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-blue-800">
            {t('credit.balance.creditExplanation')}
          </h4>
          <div className="text-xs text-blue-600">
            {isMockMode ? (
              <span className="flex items-center gap-1">
                <UserOutlined />
                {t('credit.balance.mockModeData')}
              </span>
            ) : (
              <span>{t('credit.balance.realApiData')}</span>
            )}
          </div>
        </div>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• {t('credit.balance.explanationAvailable')}</li>
          <li>• {t('credit.balance.explanationTotal')}</li>
          <li>• {t('credit.balance.explanationFifo')}</li>
          <li>• {t('credit.balance.explanationExpiry')}</li>
          {currentUser && (
            <li className="text-orange-700">
              • {t('credit.balance.expectedBalance', { balance: currentUser.expectedBalance })}
            </li>
          )}
        </ul>
      </div>

      {/* 调试信息 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
          <div className="font-mono space-y-1">
            <div>
              {t('credit.balance.debugApiData')}: {JSON.stringify({ creditBalance, creditAmount })}
            </div>
            <div>
              {t('credit.balance.debugCalculatedData')}:{' '}
              {JSON.stringify({ calculatedBalance, calculatedAmount })}
            </div>
            <div>
              {t('credit.balance.debugRechargeCount')}: {rechargeRecords.length}
            </div>
            <div>
              {t('credit.balance.debugMockMode')}: {isMockMode ? t('common.yes') : t('common.no')}
            </div>
            <div>
              {t('credit.balance.debugCurrentUser')}:{' '}
              {currentUser?.uid || t('credit.balance.notSelected')}
            </div>
            <div>
              {t('credit.balance.debugDataConsistency')}:{' '}
              {isDataConsistent ? t('credit.balance.consistent') : t('credit.balance.inconsistent')}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default CreditBalance;
