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
          action={
            <Button
              type="primary"
              size="small"
              onClick={() => {
                refetchBalance();
                refetchRecharge();
              }}
            >
              重试
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
      title: '充值ID',
      dataIndex: 'rechargeId',
      key: 'rechargeId',
      render: (id: string) => id.slice(-8),
      width: 100,
    },
    {
      title: '充值金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `${amount?.toLocaleString()} 积分`,
      width: 120,
    },
    {
      title: '剩余余额',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: number) => `${balance?.toLocaleString()} 积分`,
      width: 120,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 80,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '创建时间',
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
            <span>积分余额</span>
            {!isDataConsistent && (
              <InfoCircleOutlined className="text-orange-500" title="数据不一致，请检查" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {isMockMode && currentUser && (
              <div className="flex items-center gap-2 text-sm">
                <UserOutlined className="text-orange-500" />
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs">
                  模拟: {currentUser.displayName}
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
              title="刷新数据"
            />
          </div>
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

      {/* 数据一致性状态 */}
      {!isDataConsistent && (
        <Alert
          message="数据不一致警告"
          description={`计算值与API返回值不匹配：计算总额=${calculatedAmount}，API总额=${creditAmount}；计算余额=${calculatedBalance}，API余额=${creditBalance}`}
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
              <span className="font-medium">积分计算详情</span>
              <span className="text-xs text-gray-500">({rechargeRecords.length} 条充值记录)</span>
            </div>
          }
          key="calculation"
        >
          <div className="space-y-4">
            {/* 计算公式说明 */}
            <div className="p-3 bg-green-50 rounded-lg">
              <h4 className="text-sm font-medium text-green-800 mb-2">计算公式</h4>
              <div className="text-sm text-green-700 space-y-1">
                <div>
                  • <strong>总充值积分</strong> = Σ(所有充值记录.amount)
                </div>
                <div>
                  • <strong>可用积分</strong> = Σ(所有充值记录.balance)
                </div>
                <div>
                  • <strong>已使用积分</strong> = 总充值积分 - 可用积分
                </div>
              </div>
            </div>

            {/* 计算过程 */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-800 mb-2">计算过程</h4>
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  • 总充值积分 = {rechargeRecords.map((r) => r.amount).join(' + ')} ={' '}
                  <strong>{calculatedAmount.toLocaleString()}</strong>
                </div>
                <div>
                  • 可用积分 = {rechargeRecords.map((r) => r.balance).join(' + ')} ={' '}
                  <strong>{calculatedBalance.toLocaleString()}</strong>
                </div>
                <div>
                  • 已使用积分 = {calculatedAmount.toLocaleString()} -{' '}
                  {calculatedBalance.toLocaleString()} ={' '}
                  <strong>{(calculatedAmount - calculatedBalance).toLocaleString()}</strong>
                </div>
              </div>
            </div>

            {/* 充值记录明细 */}
            <div>
              <h4 className="text-sm font-medium text-gray-800 mb-2">充值记录明细</h4>
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
                          <strong>合计</strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1}>
                          <strong className="text-blue-600">
                            {totalAmount.toLocaleString()} 积分
                          </strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2}>
                          <strong className="text-green-600">
                            {totalBalance.toLocaleString()} 积分
                          </strong>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3}>
                          <span className="text-orange-600">
                            已使用: {totalUsed.toLocaleString()}
                          </span>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4} colSpan={2}>
                          <span className="text-xs text-gray-500">
                            使用率:{' '}
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
              <h4 className="text-sm font-medium text-blue-800 mb-2">数据验证</h4>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>API总充值积分:</span>
                  <span
                    className={
                      creditAmount === calculatedAmount ? 'text-green-600' : 'text-red-600'
                    }
                  >
                    {creditAmount.toLocaleString()} {creditAmount === calculatedAmount ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>计算总充值积分:</span>
                  <span>{calculatedAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>API可用积分:</span>
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
                  <span>计算可用积分:</span>
                  <span>{calculatedBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>数据一致性:</span>
                  <span className={isDataConsistent ? 'text-green-600' : 'text-red-600'}>
                    {isDataConsistent ? '✅ 一致' : '❌ 不一致'}
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
          <h4 className="text-sm font-medium text-blue-800">积分说明</h4>
          <div className="text-xs text-blue-600">
            {isMockMode ? (
              <span className="flex items-center gap-1">
                <UserOutlined />
                模拟模式数据
              </span>
            ) : (
              <span>真实API数据</span>
            )}
          </div>
        </div>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 可用积分：当前可以使用的积分数量（充值记录余额总和）</li>
          <li>• 总充值积分：历史累计充值的积分总额（充值记录金额总和）</li>
          <li>• 积分按FIFO原则消耗（先进先出，最早充值的先被使用）</li>
          <li>• 积分充值后有效期为30天，过期后自动失效</li>
          {currentUser && (
            <li className="text-orange-700">
              • 当前测试用户预期余额: {currentUser.expectedBalance} 积分
            </li>
          )}
        </ul>
      </div>

      {/* 调试信息 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
          <div className="font-mono space-y-1">
            <div>API数据: {JSON.stringify({ creditBalance, creditAmount })}</div>
            <div>计算数据: {JSON.stringify({ calculatedBalance, calculatedAmount })}</div>
            <div>充值记录数: {rechargeRecords.length}</div>
            <div>模拟模式: {isMockMode ? '是' : '否'}</div>
            <div>当前用户: {currentUser?.uid || '未选择'}</div>
            <div>数据一致性: {isDataConsistent ? '一致' : '不一致'}</div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default CreditBalance;
