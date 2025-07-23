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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useGetCreditRecharge();

  if (isLoading) {
    return (
      <Card title={t('credit.recharge.title')} className="mb-6">
        <div className="flex justify-center items-center h-32">
          <Spin size="large" tip={t('common.loading')} />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title={t('credit.recharge.title')} className="mb-6">
        <Alert
          message={t('credit.recharge.loadFailed')}
          description={t('credit.recharge.loadFailedDesc')}
          type="error"
          showIcon
          action={
            <Tooltip title={t('credit.recharge.reload')}>
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
      purchase: {
        color: 'blue',
        icon: <DollarCircleOutlined />,
        text: t('credit.recharge.source.purchase'),
      },
      gift: { color: 'green', icon: <GiftOutlined />, text: t('credit.recharge.source.gift') },
      promotion: {
        color: 'orange',
        icon: <TrophyOutlined />,
        text: t('credit.recharge.source.promotion'),
      },
      refund: { color: 'red', icon: <UndoOutlined />, text: t('credit.recharge.source.refund') },
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
          {t('credit.recharge.status.unused')}
        </Tag>
      );
    } else if (usageRate < 1) {
      return (
        <Tag color="orange" icon={<ExclamationCircleOutlined />}>
          {t('credit.recharge.status.partial')}
        </Tag>
      );
    } else {
      return <Tag color="red">{t('credit.recharge.status.depleted')}</Tag>;
    }
  };

  const columns: ColumnsType<CreditRecharge> = [
    {
      title: t('credit.recharge.columns.rechargeId'),
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
      title: t('credit.recharge.columns.amount'),
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => (
        <span className="font-medium text-blue-600">
          {amount.toLocaleString()} {t('credit.recharge.unit.credit')}
        </span>
      ),
      sorter: (a, b) => a.amount - b.amount,
      width: 120,
    },
    {
      title: t('credit.recharge.columns.balance'),
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: number, record) => (
        <div className="space-y-1">
          <span className="font-medium text-green-600">
            {balance.toLocaleString()} {t('credit.recharge.unit.credit')}
          </span>
          <div className="text-xs text-gray-500">
            {t('credit.recharge.columns.used')}: {(record.amount - balance).toLocaleString()}
          </div>
        </div>
      ),
      sorter: (a, b) => a.balance - b.balance,
      width: 120,
    },
    {
      title: t('credit.recharge.columns.usage'),
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
      title: t('credit.recharge.columns.source'),
      dataIndex: 'source',
      key: 'source',
      render: getSourceTag,
      filters: [
        { text: t('credit.recharge.source.purchase'), value: 'purchase' },
        { text: t('credit.recharge.source.gift'), value: 'gift' },
        { text: t('credit.recharge.source.promotion'), value: 'promotion' },
        { text: t('credit.recharge.source.refund'), value: 'refund' },
      ],
      onFilter: (value, record) => record.source === value,
      width: 80,
    },
    {
      title: t('credit.recharge.columns.description'),
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
      title: t('credit.recharge.columns.createdAt'),
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
      title: t('credit.recharge.columns.expiresAt'),
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
            <span>{t('credit.recharge.title')}</span>
            <span className="text-sm text-gray-500">
              ({rechargeRecords.length} {t('credit.recharge.totalRecords')})
            </span>
          </div>
          <Tooltip title={t('credit.recharge.reloadData')}>
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
          <span className="font-medium text-gray-800">{t('credit.recharge.stats.overview')}</span>
        </div>

        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title={t('credit.recharge.stats.totalAmount')}
              value={stats.totalAmount}
              precision={0}
              valueStyle={{ color: '#1677ff', fontSize: '16px' }}
              suffix={t('credit.recharge.unit.credit')}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('credit.recharge.stats.remainingBalance')}
              value={stats.totalBalance}
              precision={0}
              valueStyle={{ color: '#52c41a', fontSize: '16px' }}
              suffix={t('credit.recharge.unit.credit')}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('credit.recharge.stats.usedCredit')}
              value={stats.totalUsed}
              precision={0}
              valueStyle={{ color: '#fa8c16', fontSize: '16px' }}
              suffix={t('credit.recharge.unit.credit')}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('credit.recharge.stats.usageRate')}
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
          <div className="text-sm font-medium text-gray-700 mb-2">
            {t('credit.recharge.stats.bySource')}:
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.bySource).map(([source, data]) => (
              <div key={source} className="px-3 py-1 bg-white rounded border text-xs">
                {getSourceTag(source)}
                <span className="ml-2 text-gray-600">
                  {data.count} {t('credit.recharge.stats.times')}, {data.amount.toLocaleString()}{' '}
                  {t('credit.recharge.unit.credit')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 使用状态统计 */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">
            {t('credit.recharge.stats.usageStatus')}:
          </div>
          <div className="flex gap-4 text-xs">
            <span className="flex items-center gap-1">
              <Tag color="green" size="small">
                {t('credit.recharge.status.unused')}
              </Tag>
              {stats.statusCounts.unused} {t('credit.recharge.stats.records')}
            </span>
            <span className="flex items-center gap-1">
              <Tag color="orange" size="small">
                {t('credit.recharge.status.partial')}
              </Tag>
              {stats.statusCounts.partial} {t('credit.recharge.stats.records')}
            </span>
            <span className="flex items-center gap-1">
              <Tag color="red" size="small">
                {t('credit.recharge.status.depleted')}
              </Tag>
              {stats.statusCounts.depleted} {t('credit.recharge.stats.records')}
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
          showTotal: (total, range) =>
            `${t('credit.recharge.totalRecordsRange', { start: range[0], end: range[1], total: total })}`,
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
                  <strong>{t('credit.recharge.currentPageTotal')}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <strong className="text-blue-600">
                    {pageAmount.toLocaleString()} {t('credit.recharge.unit.credit')}
                  </strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2}>
                  <strong className="text-green-600">
                    {pageBalance.toLocaleString()} {t('credit.recharge.unit.credit')}
                  </strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3}>
                  <span className="text-orange-600">
                    {t('credit.recharge.currentPageUsed')}: {pageUsed.toLocaleString()}
                  </span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} colSpan={4}>
                  <span className="text-xs text-gray-500">
                    {t('credit.recharge.pageUsageRate', {
                      rate: pageAmount > 0 ? ((pageUsed / pageAmount) * 100).toFixed(1) : 0,
                    })}
                  </span>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          );
        }}
      />

      {/* 数据说明 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
        <div className="font-medium mb-1">{t('credit.recharge.dataExplanation')}:</div>
        <ul className="space-y-1 text-xs">
          <li>
            • <strong>{t('credit.recharge.dataExplanation.amount')}</strong>:{' '}
            {t('credit.recharge.dataExplanation.amountDesc')}
          </li>
          <li>
            • <strong>{t('credit.recharge.dataExplanation.balance')}</strong>:{' '}
            {t('credit.recharge.dataExplanation.balanceDesc')}
          </li>
          <li>
            • <strong>{t('credit.recharge.dataExplanation.usage')}</strong>:{' '}
            {t('credit.recharge.dataExplanation.usageDesc')}
          </li>
          <li>
            • <strong>{t('credit.recharge.dataExplanation.fifo')}</strong>:{' '}
            {t('credit.recharge.dataExplanation.fifoDesc')}
          </li>
          <li>
            • <strong>{t('credit.recharge.dataExplanation.validity')}</strong>:{' '}
            {t('credit.recharge.dataExplanation.validityDesc')}
          </li>
        </ul>
      </div>
    </Card>
  );
};

export default CreditRechargeHistory;
