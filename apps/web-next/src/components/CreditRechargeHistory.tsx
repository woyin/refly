import React from 'react';
import { Card, Table, Alert, Spin, Tag, Tooltip } from 'antd';
import {
  ReloadOutlined,
  DollarCircleOutlined,
  GiftOutlined,
  TrophyOutlined,
  UndoOutlined,
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
 * 显示用户的积分充值记录
 */
const CreditRechargeHistory: React.FC = () => {
  const { data, isLoading, error, refetch } = useGetCreditRecharge();

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

  const columns: ColumnsType<CreditRecharge> = [
    {
      title: '充值ID',
      dataIndex: 'rechargeId',
      key: 'rechargeId',
      width: 160,
      render: (text: string) => (
        <Tooltip title={text}>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded">{text?.slice(0, 12)}...</code>
        </Tooltip>
      ),
    },
    {
      title: '充值金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount: number) => (
        <span className="font-medium text-blue-600">{amount?.toLocaleString()} 积分</span>
      ),
    },
    {
      title: '剩余余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 100,
      render: (balance: number) => (
        <span className={`font-medium ${balance > 0 ? 'text-green-600' : 'text-gray-400'}`}>
          {balance?.toLocaleString()} 积分
        </span>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (source: string) => getSourceTag(source),
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: CreditRecharge) => {
        const isExpired = new Date(record.expiresAt) < new Date();
        if (!enabled || isExpired) {
          return <Tag color="red">已过期</Tag>;
        }
        return <Tag color="green">有效</Tag>;
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '到期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 120,
      render: (date: string) => (
        <span className="text-sm">{new Date(date).toLocaleDateString('zh-CN')}</span>
      ),
    },
    {
      title: '充值时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => (
        <span className="text-sm">{new Date(date).toLocaleDateString('zh-CN')}</span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Card title="充值记录" className="mb-6">
        <div className="flex justify-center items-center h-48">
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
          description="无法获取充值记录，请稍后重试"
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

  const rechargeData = data?.data || [];

  return (
    <Card
      title={
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarCircleOutlined className="text-blue-500" />
            <span>充值记录</span>
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
      {rechargeData.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 text-lg mb-2">
            <DollarCircleOutlined />
          </div>
          <p className="text-gray-500">暂无充值记录</p>
        </div>
      ) : (
        <>
          <div className="mb-4 p-4 bg-green-50 rounded-lg">
            <h4 className="text-sm font-medium text-green-800 mb-2">充值记录说明</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• 充值金额：本次充值的积分数量</li>
              <li>• 剩余余额：该笔充值记录的剩余可用积分</li>
              <li>• 积分按充值时间先进先出(FIFO)的顺序扣减</li>
              <li>• 每笔充值有效期为30天，过期后自动失效</li>
            </ul>
          </div>

          <Table
            columns={columns}
            dataSource={rechargeData}
            rowKey="rechargeId"
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

export default CreditRechargeHistory;
