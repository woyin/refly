import React from 'react';
import { Card, Table, Alert, Spin, Tag, Tooltip } from 'antd';
import {
  ReloadOutlined,
  ThunderboltOutlined,
  CameraOutlined,
  FileTextOutlined,
  SearchOutlined,
  ToolOutlined,
} from '@ant-design/icons';
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
 * 显示用户的积分使用记录
 */
const CreditUsageHistory: React.FC = () => {
  const { data, isLoading, error, refetch } = useGetCreditUsage();

  const getUsageTypeTag = (usageType: string) => {
    const typeConfig = {
      model_call: { color: 'blue', icon: <ThunderboltOutlined />, text: '模型调用' },
      media_generation: { color: 'purple', icon: <CameraOutlined />, text: '媒体生成' },
      embedding: { color: 'green', icon: <FileTextOutlined />, text: '向量化' },
      reranking: { color: 'orange', icon: <SearchOutlined />, text: '重排序' },
      other: { color: 'gray', icon: <ToolOutlined />, text: '其他' },
    };

    const config = typeConfig[usageType as keyof typeof typeConfig] || typeConfig.other;

    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  const columns: ColumnsType<CreditUsage> = [
    {
      title: '使用ID',
      dataIndex: 'usageId',
      key: 'usageId',
      width: 160,
      render: (text: string) => (
        <Tooltip title={text}>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{text?.slice(0, 12)}...</code>
        </Tooltip>
      ),
    },
    {
      title: '消费积分',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount: number) => (
        <span className="font-medium text-red-600">-{amount?.toLocaleString()} 积分</span>
      ),
    },
    {
      title: '使用类型',
      dataIndex: 'usageType',
      key: 'usageType',
      width: 120,
      render: (usageType: string) => getUsageTypeTag(usageType),
    },
    {
      title: '模型名称',
      dataIndex: 'modelName',
      key: 'modelName',
      width: 150,
      render: (modelName?: string) => <span className="text-sm">{modelName || '-'}</span>,
    },
    {
      title: '关联操作',
      dataIndex: 'actionResultId',
      key: 'actionResultId',
      width: 160,
      render: (actionResultId?: string) =>
        actionResultId ? (
          <Tooltip title={actionResultId}>
            <code className="text-xs bg-blue-100 px-2 py-1 rounded">
              {actionResultId?.slice(0, 12)}...
            </code>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: '会话ID',
      dataIndex: 'pilotSessionId',
      key: 'pilotSessionId',
      width: 160,
      render: (pilotSessionId?: string) =>
        pilotSessionId ? (
          <Tooltip title={pilotSessionId}>
            <code className="text-xs bg-green-100 px-2 py-1 rounded">
              {pilotSessionId?.slice(0, 12)}...
            </code>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      render: (text?: string) => text || '-',
    },
    {
      title: '使用时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => (
        <span className="text-sm">{new Date(date).toLocaleString('zh-CN')}</span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Card title="使用记录" className="mb-6">
        <div className="flex justify-center items-center h-48">
          <Spin size="large" tip="加载中..." />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card title="使用记录" className="mb-6">
        <Alert
          message="加载失败"
          description="无法获取使用记录，请稍后重试"
          type="error"
          showIcon
          action={
            <button
              type="button"
              onClick={() => refetch()}
              className="text-blue-500 hover:text-blue-700"
            >
              <ReloadOutlined /> 重试
            </button>
          }
        />
      </Card>
    );
  }

  const usageData = data?.data || [];
  const totalUsage = usageData.reduce((sum, record) => sum + (record.amount || 0), 0);

  return (
    <Card
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThunderboltOutlined className="text-blue-500" />
            <span>使用记录</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-gray-500 hover:text-blue-500 transition-colors"
          >
            <ReloadOutlined />
          </button>
        </div>
      }
      className="mb-6"
    >
      {usageData.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-lg mb-2">
            <ThunderboltOutlined />
          </div>
          <p className="text-gray-500">暂无使用记录</p>
        </div>
      ) : (
        <>
          <div className="mb-4 p-4 bg-orange-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-orange-800">使用记录说明</h4>
              <span className="text-sm font-medium text-orange-600">
                总消费: {totalUsage.toLocaleString()} 积分
              </span>
            </div>
            <ul className="text-sm text-orange-700 space-y-1">
              <li>• 模型调用：AI技能调用产生的token消费</li>
              <li>• 媒体生成：图片、视频、音频生成消费</li>
              <li>• 向量化：文档向量化处理消费</li>
              <li>• 重排序：搜索结果重排序消费</li>
              <li>• 积分消费按实际使用量计算，通常按5K token为单位</li>
            </ul>
          </div>

          <Table
            columns={columns}
            dataSource={usageData}
            rowKey="usageId"
            scroll={{ x: 'max-content' }}
            size="middle"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
            }}
          />
        </>
      )}
    </Card>
  );
};

export default CreditUsageHistory;
