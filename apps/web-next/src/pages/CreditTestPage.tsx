import React from 'react';
import { Layout, Typography, Divider, Alert } from 'antd';
import { ExperimentOutlined, ApiOutlined, BookOutlined, LinkOutlined } from '@ant-design/icons';
import CreditBalance from '../components/CreditBalance';
import CreditRechargeHistory from '../components/CreditRechargeHistory';
import CreditUsageHistory from '../components/CreditUsageHistory';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;

/**
 * Credit System Test Page
 * 积分系统测试页面 - 为开发者和测试人员提供完整的积分功能测试界面
 */
const CreditTestPage: React.FC = () => {
  return (
    <Layout className="min-h-screen bg-gray-50">
      <Content className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <ExperimentOutlined className="text-2xl text-blue-500" />
            <Title level={1} className="!mb-0">
              积分系统测试页面
            </Title>
          </div>

          <Alert
            message="开发测试环境"
            description="此页面用于测试积分系统的所有功能，包括余额查询、充值记录和使用记录。适合开发者和测试人员快速验证API功能。"
            type="info"
            showIcon
            className="mb-6"
          />

          {/* API Information */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-4">
              <ApiOutlined className="text-blue-500" />
              <Title level={3} className="!mb-0">
                API 接口信息
              </Title>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <Text strong className="text-green-600">
                  GET /v1/credit/balance
                </Text>
                <Paragraph className="text-sm text-gray-600 mt-2 mb-0">
                  获取用户积分余额信息，包括可用积分和总充值积分
                </Paragraph>
              </div>

              <div className="p-4 border rounded-lg">
                <Text strong className="text-blue-600">
                  GET /v1/credit/recharge
                </Text>
                <Paragraph className="text-sm text-gray-600 mt-2 mb-0">
                  获取用户积分充值记录，包含充值来源、金额、有效期等信息
                </Paragraph>
              </div>

              <div className="p-4 border rounded-lg">
                <Text strong className="text-orange-600">
                  GET /v1/credit/usage
                </Text>
                <Paragraph className="text-sm text-gray-600 mt-2 mb-0">
                  获取用户积分使用记录，包含使用类型、消费积分、关联操作等
                </Paragraph>
              </div>
            </div>
          </div>

          {/* System Overview */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BookOutlined className="text-blue-500" />
              <Title level={3} className="!mb-0">
                积分系统概述
              </Title>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Title level={4} className="text-blue-600">
                  💰 积分充值机制
                </Title>
                <ul className="text-sm space-y-2">
                  <li>
                    • <strong>多种来源</strong>：支持购买、赠送、促销、退款等充值方式
                  </li>
                  <li>
                    • <strong>有效期管理</strong>：每笔充值有效期30天，自动过期失效
                  </li>
                  <li>
                    • <strong>余额跟踪</strong>：实时跟踪每笔充值的剩余可用积分
                  </li>
                  <li>
                    • <strong>先进先出</strong>：按充值时间顺序优先扣减最早的积分
                  </li>
                </ul>
              </div>

              <div>
                <Title level={4} className="text-green-600">
                  ⚡ 积分消费机制
                </Title>
                <ul className="text-sm space-y-2">
                  <li>
                    • <strong>多场景支持</strong>：模型调用、媒体生成、向量化、重排序
                  </li>
                  <li>
                    • <strong>精确计费</strong>：按实际token使用量计费，通常以5K token为单位
                  </li>
                  <li>
                    • <strong>实时扣减</strong>：异步处理积分扣减，不影响主业务流程
                  </li>
                  <li>
                    • <strong>详细记录</strong>：完整记录每次消费的模型、操作、会话信息
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Quick Test Actions */}
          <div className="bg-white p-6 rounded-lg shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-4">
              <LinkOutlined className="text-blue-500" />
              <Title level={3} className="!mb-0">
                快速测试指南
              </Title>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border border-dashed border-blue-300 rounded-lg text-center">
                <div className="text-blue-500 text-lg mb-2">1️⃣</div>
                <Text strong>查看余额</Text>
                <Paragraph className="text-sm text-gray-600 mt-1 mb-0">
                  检查当前积分余额状态
                </Paragraph>
              </div>

              <div className="p-4 border border-dashed border-green-300 rounded-lg text-center">
                <div className="text-green-500 text-lg mb-2">2️⃣</div>
                <Text strong>充值记录</Text>
                <Paragraph className="text-sm text-gray-600 mt-1 mb-0">
                  查看历史充值信息和有效期
                </Paragraph>
              </div>

              <div className="p-4 border border-dashed border-orange-300 rounded-lg text-center">
                <div className="text-orange-500 text-lg mb-2">3️⃣</div>
                <Text strong>使用记录</Text>
                <Paragraph className="text-sm text-gray-600 mt-1 mb-0">
                  分析积分消费情况和模式
                </Paragraph>
              </div>

              <div className="p-4 border border-dashed border-purple-300 rounded-lg text-center">
                <div className="text-purple-500 text-lg mb-2">4️⃣</div>
                <Text strong>接口测试</Text>
                <Paragraph className="text-sm text-gray-600 mt-1 mb-0">
                  验证API响应和错误处理
                </Paragraph>
              </div>
            </div>
          </div>
        </div>

        <Divider />

        {/* Main Content - Credit System Components */}
        <div className="space-y-8">
          {/* Credit Balance Section */}
          <CreditBalance />

          {/* Credit Recharge History Section */}
          <CreditRechargeHistory />

          {/* Credit Usage History Section */}
          <CreditUsageHistory />
        </div>

        {/* Footer Information */}
        <div className="mt-12 p-6 bg-gray-100 rounded-lg">
          <Title level={4} className="text-gray-700 mb-4">
            💡 测试注意事项
          </Title>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <Text strong>认证要求：</Text>
              <ul className="mt-2 space-y-1">
                <li>• 所有API需要JWT认证</li>
                <li>• 确保用户已登录状态</li>
                <li>• 检查Token有效性</li>
              </ul>
            </div>

            <div>
              <Text strong>数据刷新：</Text>
              <ul className="mt-2 space-y-1">
                <li>• 数据支持手动刷新</li>
                <li>• 点击刷新按钮重新加载</li>
                <li>• 查看网络请求状态</li>
              </ul>
            </div>

            <div>
              <Text strong>错误处理：</Text>
              <ul className="mt-2 space-y-1">
                <li>• 网络错误友好提示</li>
                <li>• 支持重试机制</li>
                <li>• 加载状态显示</li>
              </ul>
            </div>

            <div>
              <Text strong>数据格式：</Text>
              <ul className="mt-2 space-y-1">
                <li>• 时间显示本地化</li>
                <li>• 积分数量格式化</li>
                <li>• ID字段截断显示</li>
              </ul>
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  );
};

export default CreditTestPage;
