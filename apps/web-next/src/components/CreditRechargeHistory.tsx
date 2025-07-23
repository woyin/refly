import React from 'react';
import { Card, Table, Alert, Spin, Tag, Tooltip, Statistic, Row, Col } from 'antd';
import {
  ReloadOutlined,
  DollarCircleOutlined,
  GiftOutlined,
  TrophyOutlined,
  UndoOutlined,
  CalculatorOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useGetCreditRecharge } from '@refly-packages/ai-workspace-common/queries/queries';
import type { ColumnsType } from 'antd/es/table';

interface CreditRecharge {
  rechargeId: string;
  amount: number;
  balance: number;
  source: 'purchase' | 'gift' | 'promotion' | 'refund';
  description?: string;
  expiresAt: string;
  createdAt: string;
  enabled: boolean;
}

/**
 * Credit Recharge History Component
 * 显示用户的积分充值记录，包含统计分析
 */
const CreditRechargeHistory: React.FC = () => {
  const { data, isLoading, error, refetch } = useGetCreditRecharge();

  if (isLoading) {
    return (
      <Card title="充值记录" className="mb-6">
        <div className="flex justify-center items-center h-32">
          <Spin size="large" tip="加载中..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="充值记录" className="mb-6">
        <Alert
          message="加载失败"
          description="无法获取充值记录信息，请稍后重试"
          type="error"
          showIcon
          action={
            <Tooltip title="重新加载数据">
              <ReloadOutlined className="cursor-pointer text-blue-500" onClick={() => refetch()} />
            </Tooltip>
          }
        />
      </Card>
    );
  }

  const rechargeRecords = data?.data || [];

  // 计算统计数据
  const stats = rechargeRecords.reduce(
    (acc, record) => {
      acc.totalAmount += record.amount;
      acc.totalBalance += record.balance;
      acc.totalUsed += record.amount - record.balance;

      // 按来源统计
      if (!acc.bySource[record.source]) {
        acc.bySource[record.source] = { count: 0, amount: 0, balance: 0 };
      }
      acc.bySource[record.source].count += 1;
      acc.bySource[record.source].amount += record.amount;
      acc.bySource[record.source].balance += record.balance;

      // 状态统计
      const usageRate = record.amount > 0 ? (record.amount - record.balance) / record.amount : 0;
      if (usageRate === 0) {
        acc.statusCounts.unused += 1;
      } else if (usageRate < 1) {
        acc.statusCounts.partial += 1;
      } else {
        acc.statusCounts.depleted += 1;
      }

      return acc;
    },
    {
      totalAmount: 0,
      totalBalance: 0,
      totalUsed: 0,
      bySource: {} as Record<string, { count: number; amount: number; balance: number }>,
      statusCounts: { unused: 0, partial: 0, depleted: 0 },
    },
  );

  const usageRate = stats.totalAmount > 0 ? (stats.totalUsed / stats.totalAmount) * 100 : 0;

  const getSourceTag = (source: string) => {
    const sourceConfig = {
      purchase: { color: 'blue', icon: <DollarCircleOutlined />, text: '购买' },
      gift: { color: 'green', icon: <GiftOutlined />, text: '赠送' },
      promotion: { color: 'orange', icon: <TrophyOutlined />, text: '促销' },
      refund: { color: 'red', icon: <UndoOutlined />, text: '退款' },
    };

    const config = sourceConfig[source as keyof typeof sourceConfig] || sourceConfig.purchase;

    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const getBalanceStatus = (amount: number, balance: number) => {
    const usageRate = amount > 0 ? (amount - balance) / amount : 0;

    if (usageRate === 0) {
      return (
        <Tag color="green" icon={<CheckCircleOutlined />}>
          未使用
        </Tag>
      );
    } else if (usageRate < 1) {
      return (
        <Tag color="orange" icon={<ExclamationCircleOutlined />}>
          部分使用
        </Tag>
      );
    } else {
      return <Tag color="red">已耗尽</Tag>;
    }
  };

  const columns: ColumnsType<CreditRecharge> = [
    {
      title: '充值ID',
      dataIndex: 'rechargeId',
      key: 'rechargeId',
      render: (id: string) => (
        <Tooltip title={id}>
          <code className="text-xs">{id.slice(-8)}</code>
        </Tooltip>
      ),
      width: 100,
    },
    {
      title: '充值金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => (
        <span className="font-medium text-blue-600">{amount.toLocaleString()} 积分</span>
      ),
      sorter: (a, b) => a.amount - b.amount,
      width: 120,
    },
    {
      title: '剩余余额',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: number, record) => (
        <div className="space-y-1">
          <span className="font-medium text-green-600">{balance.toLocaleString()} 积分</span>
          <div className="text-xs text-gray-500">
            已用: {(record.amount - balance).toLocaleString()}
          </div>
        </div>
      ),
      sorter: (a, b) => a.balance - b.balance,
      width: 120,
    },
    {
      title: '使用情况',
      key: 'usage',
      render: (_, record) => (
        <div className="space-y-1">
          {getBalanceStatus(record.amount, record.balance)}
          <div className="text-xs text-gray-500">
            {record.amount > 0
              ? (((record.amount - record.balance) / record.amount) * 100).toFixed(1)
              : 0}
            %
          </div>
        </div>
      ),
      width: 100,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: getSourceTag,
      filters: [
        { text: '购买', value: 'purchase' },
        { text: '赠送', value: 'gift' },
        { text: '促销', value: 'promotion' },
        { text: '退款', value: 'refund' },
      ],
      onFilter: (value, record) => record.source === value,
      width: 80,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: {
        showTitle: false,
      },
      render: (description: string) => (
        <Tooltip title={description} placement="topLeft">
          <span>{description}</span>
        </Tooltip>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          <span className="text-xs">{new Date(date).toLocaleDateString()}</span>
        </Tooltip>
      ),
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      width: 100,
    },
    {
      title: '到期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (date: string) => {
        const expireDate = new Date(date);
        const isExpired = expireDate < new Date();
        return (
          <Tooltip title={expireDate.toLocaleString()}>
            <span className={`text-xs ${isExpired ? 'text-red-500' : 'text-gray-600'}`}>
              {expireDate.toLocaleDateString()}
            </span>
          </Tooltip>
        );
      },
      sorter: (a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime(),
      width: 100,
    },
  ];

  return (
    <Card
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarCircleOutlined className="text-green-500" />
            <span>充值记录</span>
            <span className="text-sm text-gray-500">({rechargeRecords.length} 条)</span>
          </div>
          <Tooltip title="刷新数据">
            <ReloadOutlined className="cursor-pointer text-blue-500" onClick={() => refetch()} />
          </Tooltip>
        </div>
      }
      className="mb-6"
    >
      {/* 统计概览 */}
      <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <CalculatorOutlined className="text-blue-600" />
          <span className="font-medium text-gray-800">充值统计概览</span>
        </div>

        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="总充值金额"
              value={stats.totalAmount}
              precision={0}
              valueStyle={{ color: '#1677ff', fontSize: '16px' }}
              suffix="积分"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="剩余余额"
              value={stats.totalBalance}
              precision={0}
              valueStyle={{ color: '#52c41a', fontSize: '16px' }}
              suffix="积分"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="已使用积分"
              value={stats.totalUsed}
              precision={0}
              valueStyle={{ color: '#fa8c16', fontSize: '16px' }}
              suffix="积分"
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="使用率"
              value={usageRate}
              precision={1}
              valueStyle={{
                color: usageRate > 80 ? '#ff4d4f' : usageRate > 50 ? '#fa8c16' : '#52c41a',
                fontSize: '16px',
              }}
              suffix="%"
            />
          </Col>
        </Row>

        {/* 来源统计 */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">按来源统计:</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.bySource).map(([source, data]) => (
              <div key={source} className="px-3 py-1 bg-white rounded border text-xs">
                {getSourceTag(source)}
                <span className="ml-2 text-gray-600">
                  {data.count}次 / {data.amount.toLocaleString()}积分
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 使用状态统计 */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">使用状态统计:</div>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1">
              <Tag color="green" size="small">
                未使用
              </Tag>
              {stats.statusCounts.unused} 条
            </span>
            <span className="flex items-center gap-1">
              <Tag color="orange" size="small">
                部分使用
              </Tag>
              {stats.statusCounts.partial} 条
            </span>
            <span className="flex items-center gap-1">
              <Tag color="red" size="small">
                已耗尽
              </Tag>
              {stats.statusCounts.depleted} 条
            </span>
          </div>
        </div>
      </div>

      {/* 充值记录表格 */}
      <Table
        columns={columns}
        dataSource={rechargeRecords}
        rowKey="rechargeId"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条记录`,
        }}
        summary={(pageData) => {
          if (pageData.length === 0) return null;

          const pageAmount = pageData.reduce((sum, record) => sum + record.amount, 0);
          const pageBalance = pageData.reduce((sum, record) => sum + record.balance, 0);
          const pageUsed = pageAmount - pageBalance;

          return (
            <Table.Summary fixed>
              <Table.Summary.Row className="bg-blue-50">
                <Table.Summary.Cell index={0}>
                  <strong>当前页合计</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <strong className="text-blue-600">{pageAmount.toLocaleString()} 积分</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <strong className="text-green-600">{pageBalance.toLocaleString()} 积分</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3}>
                  <span className="text-orange-600">已用: {pageUsed.toLocaleString()}</span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} colSpan={4}>
                  <span className="text-xs text-gray-500">
                    页面使用率: {pageAmount > 0 ? ((pageUsed / pageAmount) * 100).toFixed(1) : 0}%
                  </span>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          );
        }}
      />

      {/* 数据说明 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
        <div className="font-medium mb-1">数据说明:</div>
        <ul className="space-y-1 text-xs">
          <li>
            • <strong>充值金额</strong>: 每次充值的原始积分数量
          </li>
          <li>
            • <strong>剩余余额</strong>: 该笔充值记录的当前可用积分
          </li>
          <li>
            • <strong>使用情况</strong>: 该笔充值的积分消耗状态和百分比
          </li>
          <li>
            • <strong>FIFO原则</strong>: 积分按先进先出顺序消耗，最早充值的先被使用
          </li>
          <li>
            • <strong>有效期</strong>: 充值后30天内有效，过期后自动失效
          </li>
        </ul>
      </div>
    </Card>
  );
};

export default CreditRechargeHistory;
