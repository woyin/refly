import React from 'react';
import { Card, Table, Alert, Spin, Tag, Tooltip, Statistic, Row, Col } from 'antd';
import {
  ReloadOutlined,
  ThunderboltOutlined,
  CameraOutlined,
  FileTextOutlined,
  SearchOutlined,
  ToolOutlined,
  BarChartOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useGetCreditUsage } from '@refly-packages/ai-workspace-common/queries/queries';
import type { ColumnsType } from 'antd/es/table';

interface CreditUsage {
  usageId: string;
  amount: number;
  providerItemId?: string;
  modelName?: string;
  usageType: 'model_call' | 'media_generation' | 'embedding' | 'reranking' | 'other';
  actionResultId?: string;
  pilotSessionId?: string;
  description?: string;
  createdAt: string;
}

/**
 * Credit Usage History Component
 * 显示用户的积分使用记录，包含使用统计和分析
 */
const CreditUsageHistory: React.FC = () => {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useGetCreditUsage();

  if (isLoading) {
    return (
      <Card title={t('credit.usage.title')} className="mb-6">
        <div className="flex justify-center items-center h-32">
          <Spin size="large" tip={t('common.loading')} />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title={t('credit.usage.title')} className="mb-6">
        <Alert
          message={t('credit.usage.loadFailed')}
          description={t('credit.usage.loadFailedDesc')}
          type="error"
          showIcon
          action={
            <Tooltip title={t('credit.usage.reload')}>
              <ReloadOutlined className="cursor-pointer text-blue-500" onClick={() => refetch()} />
            </Tooltip>
          }
        />
      </Card>
    );
  }

  const usageRecords = data?.data || [];

  // 计算使用统计
  const stats = usageRecords.reduce(
    (acc, record) => {
      acc.totalUsage += record.amount;
      acc.totalRecords += 1;

      // 按使用类型统计
      if (!acc.byUsageType[record.usageType]) {
        acc.byUsageType[record.usageType] = { count: 0, amount: 0 };
      }
      acc.byUsageType[record.usageType].count += 1;
      acc.byUsageType[record.usageType].amount += record.amount;

      // 按模型统计
      if (record.modelName) {
        if (!acc.byModel[record.modelName]) {
          acc.byModel[record.modelName] = { count: 0, amount: 0 };
        }
        acc.byModel[record.modelName].count += 1;
        acc.byModel[record.modelName].amount += record.amount;
      }

      // 按日期统计（按天）
      const dateKey = new Date(record.createdAt).toLocaleDateString();
      if (!acc.byDate[dateKey]) {
        acc.byDate[dateKey] = { count: 0, amount: 0 };
      }
      acc.byDate[dateKey].count += 1;
      acc.byDate[dateKey].amount += record.amount;

      // 单次使用统计
      if (record.amount > acc.maxSingleUsage) {
        acc.maxSingleUsage = record.amount;
      }
      if (record.amount < acc.minSingleUsage || acc.minSingleUsage === 0) {
        acc.minSingleUsage = record.amount;
      }

      return acc;
    },
    {
      totalUsage: 0,
      totalRecords: 0,
      byUsageType: {} as Record<string, { count: number; amount: number }>,
      byModel: {} as Record<string, { count: number; amount: number }>,
      byDate: {} as Record<string, { count: number; amount: number }>,
      maxSingleUsage: 0,
      minSingleUsage: 0,
    },
  );

  const averageUsage = stats.totalRecords > 0 ? stats.totalUsage / stats.totalRecords : 0;

  // 获取最近7天的使用数据
  const recentDays = Object.entries(stats.byDate)
    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, 7);

  const getUsageTypeTag = (usageType: string) => {
    const typeConfig = {
      model_call: {
        color: 'blue',
        icon: <ThunderboltOutlined />,
        text: t('credit.usage.type.model_call'),
      },
      media_generation: {
        color: 'purple',
        icon: <CameraOutlined />,
        text: t('credit.usage.type.media_generation'),
      },
      embedding: {
        color: 'green',
        icon: <FileTextOutlined />,
        text: t('credit.usage.type.embedding'),
      },
      reranking: {
        color: 'orange',
        icon: <SearchOutlined />,
        text: t('credit.usage.type.reranking'),
      },
      other: { color: 'gray', icon: <ToolOutlined />, text: t('credit.usage.type.other') },
    };

    const config = typeConfig[usageType as keyof typeof typeConfig] || typeConfig.other;

    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const getAmountTag = (amount: number) => {
    let color = 'green';
    if (amount > 100) color = 'orange';
    if (amount > 300) color = 'red';

    return (
      <Tag color={color}>
        {amount} {t('credit.usage.points')}
      </Tag>
    );
  };

  const columns: ColumnsType<CreditUsage> = [
    {
      title: t('credit.usage.usageId'),
      dataIndex: 'usageId',
      key: 'usageId',
      render: (id: string) => (
        <Tooltip title={id}>
          <code className="text-xs">{id.slice(-8)}</code>
        </Tooltip>
      ),
      width: 100,
    },
    {
      title: t('credit.usage.amount'),
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => getAmountTag(amount),
      sorter: (a, b) => a.amount - b.amount,
      width: 100,
    },
    {
      title: t('credit.usage.usageType'),
      dataIndex: 'usageType',
      key: 'usageType',
      render: getUsageTypeTag,
      filters: [
        { text: t('credit.usage.type.model_call'), value: 'model_call' },
        { text: t('credit.usage.type.media_generation'), value: 'media_generation' },
        { text: t('credit.usage.type.embedding'), value: 'embedding' },
        { text: t('credit.usage.type.reranking'), value: 'reranking' },
        { text: t('credit.usage.type.other'), value: 'other' },
      ],
      onFilter: (value, record) => record.usageType === value,
      width: 120,
    },
    {
      title: t('credit.usage.modelName'),
      dataIndex: 'modelName',
      key: 'modelName',
      render: (modelName: string) => (
        <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{modelName || '-'}</span>
      ),
      width: 150,
    },
    {
      title: t('credit.usage.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: {
        showTitle: false,
      },
      render: (description: string) => (
        <Tooltip title={description} placement="topLeft">
          <span>{description || '-'}</span>
        </Tooltip>
      ),
    },
    {
      title: t('credit.usage.pilotSessionId'),
      dataIndex: 'pilotSessionId',
      key: 'pilotSessionId',
      render: (sessionId: string) =>
        sessionId ? (
          <Tooltip title={sessionId}>
            <code className="text-xs">{sessionId.slice(-8)}</code>
          </Tooltip>
        ) : (
          '-'
        ),
      width: 100,
    },
    {
      title: t('credit.usage.createdAt'),
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
  ];

  return (
    <Card
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThunderboltOutlined className="text-orange-500" />
            <span>{t('credit.usage.title')}</span>
            <span className="text-sm text-gray-500">
              ({usageRecords.length} {t('credit.usage.records')})
            </span>
          </div>
          <Tooltip title={t('credit.usage.refresh')}>
            <ReloadOutlined className="cursor-pointer text-blue-500" onClick={() => refetch()} />
          </Tooltip>
        </div>
      }
      className="mb-6"
    >
      {/* 使用统计概览 */}
      <div className="mb-4 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <BarChartOutlined className="text-orange-600" />
          <span className="font-medium text-gray-800">{t('credit.usage.overview')}</span>
        </div>

        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title={t('credit.usage.totalUsage')}
              value={stats.totalUsage}
              precision={0}
              valueStyle={{ color: '#fa541c', fontSize: '16px' }}
              suffix={t('credit.usage.points')}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('credit.usage.usageCount')}
              value={stats.totalRecords}
              precision={0}
              valueStyle={{ color: '#1677ff', fontSize: '16px' }}
              suffix={t('credit.usage.times')}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('credit.usage.averageUsage')}
              value={averageUsage}
              precision={1}
              valueStyle={{ color: '#722ed1', fontSize: '16px' }}
              suffix={`${t('credit.usage.points')}/${t('credit.usage.times')}`}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title={t('credit.usage.maxSingleUsage')}
              value={stats.maxSingleUsage}
              precision={0}
              valueStyle={{ color: '#f5222d', fontSize: '16px' }}
              suffix={t('credit.usage.points')}
            />
          </Col>
        </Row>

        {/* 使用类型统计 */}
        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">{t('credit.usage.byType')}:</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byUsageType)
              .sort(([, a], [, b]) => b.amount - a.amount)
              .map(([type, data]) => (
                <div key={type} className="px-3 py-1 bg-white rounded border text-xs">
                  {getUsageTypeTag(type)}
                  <span className="ml-2 text-gray-600">
                    {data.count} {t('credit.usage.times')} / {data.amount.toLocaleString()}{' '}
                    {t('credit.usage.points')}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* 热门模型统计 */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">
            {t('credit.usage.popularModels')}:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(stats.byModel)
              .sort(([, a], [, b]) => b.amount - a.amount)
              .slice(0, 5)
              .map(([model, data]) => (
                <div key={model} className="px-3 py-2 bg-white rounded border text-xs">
                  <div className="font-mono font-medium text-gray-800">{model}</div>
                  <div className="text-gray-600">
                    {data.count} {t('credit.usage.times')} / {data.amount.toLocaleString()}{' '}
                    {t('credit.usage.points')}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* 最近7天使用趋势 */}
        {recentDays.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <CalendarOutlined className="text-blue-600" />
              <span className="text-sm font-medium text-gray-700">
                {t('credit.usage.recentTrend')}:
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {recentDays.map(([date, data]) => (
                <div
                  key={date}
                  className="flex-shrink-0 px-3 py-2 bg-white rounded border text-xs min-w-0"
                >
                  <div className="font-medium text-gray-800">{date}</div>
                  <div className="text-gray-600">
                    {data.count} {t('credit.usage.times')} / {data.amount.toLocaleString()}{' '}
                    {t('credit.usage.points')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 使用记录表格 */}
      <Table
        columns={columns}
        dataSource={usageRecords}
        rowKey="usageId"
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${t('credit.usage.pageTotal', { start: range[0], end: range[1], total: total })}`,
        }}
        summary={(pageData) => {
          if (pageData.length === 0) return null;

          const pageTotal = pageData.reduce((sum, record) => sum + record.amount, 0);
          const pageCount = pageData.length;
          const pageAverage = pageCount > 0 ? pageTotal / pageCount : 0;

          return (
            <Table.Summary fixed>
              <Table.Summary.Row className="bg-orange-50">
                <Table.Summary.Cell index={0}>
                  <strong>{t('credit.usage.currentPageTotal')}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <strong className="text-orange-600">
                    {pageTotal.toLocaleString()} {t('credit.usage.points')}
                  </strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} colSpan={2}>
                  <span className="text-blue-600">
                    {pageCount} {t('credit.usage.times')}
                  </span>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={4} colSpan={3}>
                  <span className="text-xs text-gray-500">
                    {t('credit.usage.pageAverage', { average: pageAverage.toFixed(1) })}
                  </span>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          );
        }}
      />

      {/* 数据说明 */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
        <div className="font-medium mb-1">{t('credit.usage.dataDescription')}:</div>
        <ul className="space-y-1 text-xs">
          <li>
            • <strong>{t('credit.usage.pointsConsumed')}</strong>:{' '}
            {t('credit.usage.pointsConsumedDesc')}
          </li>
          <li>
            • <strong>{t('credit.usage.usageType')}</strong>: {t('credit.usage.usageTypeDesc')}
          </li>
          <li>
            • <strong>{t('credit.usage.modelName')}</strong>: {t('credit.usage.modelNameDesc')}
          </li>
          <li>
            • <strong>{t('credit.usage.fifoDeduction')}</strong>:{' '}
            {t('credit.usage.fifoDeductionDesc')}
          </li>
          <li>
            • <strong>{t('credit.usage.realTimeRecord')}</strong>:{' '}
            {t('credit.usage.realTimeRecordDesc')}
          </li>
        </ul>
      </div>
    </Card>
  );
};

export default CreditUsageHistory;
