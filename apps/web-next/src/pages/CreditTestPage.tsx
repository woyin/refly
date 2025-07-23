import React from 'react';
import { Layout, Typography, Alert, Space, Button, Select, Card, Row, Col, message } from 'antd';
import {
  ExperimentOutlined,
  ApiOutlined,
  BookOutlined,
  LinkOutlined,
  UserSwitchOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import CreditBalance from '../components/CreditBalance';
import CreditRechargeHistory from '../components/CreditRechargeHistory';
import CreditUsageHistory from '../components/CreditUsageHistory';
import { useMockUser, TEST_USERS } from '../hooks/useMockUser';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

/**
 * Credit System Test Page
 * 积分系统测试页面 - 为开发者和测试人员提供完整的积分功能测试界面
 */
const CreditTestPage: React.FC = () => {
  const { selectedUser, currentUser, isMockMode, switchUser, enableMockMode, loginAsTestUser } =
    useMockUser();

  const handleUserSwitch = (userUid: string) => {
    const newUser = TEST_USERS.find((u) => u.uid === userUid);
    message.loading(`正在切换到用户: ${newUser?.displayName}...`, 1);
    switchUser(userUid);

    // Show success message after data loading
    setTimeout(() => {
      message.success(`✅ 已切换到用户: ${newUser?.displayName}，数据已刷新`);
    }, 600);
  };

  const handleLoginAsTestUser = async () => {
    if (!currentUser) return;
    message.loading('正在登录测试用户...', 2.5);
    try {
      const success = await loginAsTestUser(selectedUser);
      if (success) {
        message.success(`✅ 成功登录: ${currentUser.displayName}，数据已刷新`);
      } else {
        message.error('❌ 登录失败，请检查网络或服务器状态');
      }
    } catch (error) {
      message.error('❌ 登录过程中发生错误');
      console.error('Login error:', error);
    }
  };

  return (
    <Layout className="min-h-screen bg-gray-50">
      <Content className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <ExperimentOutlined className="text-2xl text-blue-600" />
            <Title level={2} className="!mb-0">
              积分系统测试页面
            </Title>
          </div>
          <Paragraph className="text-gray-600 text-lg">
            完整的积分功能测试界面，支持多用户场景验证和实时数据查看
          </Paragraph>
        </div>

        {/* Test User Selector */}
        <Card
          className="mb-6"
          title={
            <div className="flex items-center gap-2">
              <UserSwitchOutlined className="text-blue-600" />
              <span>测试用户选择器</span>
            </div>
          }
        >
          <Alert
            message="快速测试说明"
            description="选择不同的测试用户来验证各种积分场景。可以直接切换查看数据，或者点击登录按钮实际登录该用户。"
            type="info"
            showIcon
            className="mb-4"
          />

          <Row gutter={16} align="middle">
            <Col span={10}>
              <div className="mb-2">
                <Text strong>选择测试用户:</Text>
              </div>
              <Select
                value={selectedUser}
                onChange={handleUserSwitch}
                className="w-full"
                size="large"
                placeholder="选择测试用户"
              >
                {TEST_USERS.map((user) => (
                  <Option key={user.uid} value={user.uid}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: user.color }}
                      />
                      <span>{user.displayName}</span>
                      <span className="text-gray-500">({user.expectedBalance} credits)</span>
                    </div>
                  </Option>
                ))}
              </Select>
            </Col>

            <Col span={8}>
              <div className="mb-2">
                <Text strong>登录操作:</Text>
              </div>
              <Space>
                <Button
                  type="primary"
                  icon={<LoginOutlined />}
                  onClick={handleLoginAsTestUser}
                  size="large"
                >
                  登录此用户
                </Button>
                <Button
                  type={isMockMode ? 'primary' : 'default'}
                  onClick={enableMockMode}
                  size="large"
                >
                  {isMockMode ? '模拟模式' : '启用模拟'}
                </Button>
              </Space>
            </Col>

            <Col span={6}>
              <div className="mb-2">
                <Text strong>帮助链接:</Text>
              </div>
              <Space>
                <Button
                  type="link"
                  onClick={() => window.open('/credit-test-validation', '_blank')}
                >
                  测试指南
                </Button>
                <Button
                  type="link"
                  onClick={() => window.open('http://localhost:5800/api-docs', '_blank')}
                >
                  API文档
                </Button>
              </Space>
            </Col>
          </Row>

          {currentUser && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: currentUser.color }}
                />
                <Text strong className="text-lg">
                  {currentUser.displayName}
                </Text>
                <Text code>{currentUser.email}</Text>
                {isMockMode && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    模拟模式
                  </span>
                )}
              </div>
              <Text className="text-gray-600">{currentUser.description}</Text>
              <div className="mt-2">
                <Text strong>测试场景: </Text>
                <Text>{currentUser.scenario}</Text>
              </div>
              <div className="mt-1">
                <Text strong>预期余额: </Text>
                <Text type="success">{currentUser.expectedBalance} credits</Text>
              </div>
              <div className="mt-1">
                <Text strong>登录密码: </Text>
                <Text code>testPassword123</Text>
              </div>
            </div>
          )}
        </Card>

        {/* Quick Testing Guide */}
        <Card className="mb-6" title="🚀 快速测试指南">
          <Row gutter={16}>
            <Col span={6}>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl mb-2">1️⃣</div>
                <Text strong>选择用户</Text>
                <div className="text-sm text-gray-500 mt-1">从下拉菜单选择测试用户</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl mb-2">2️⃣</div>
                <Text strong>登录用户</Text>
                <div className="text-sm text-gray-500 mt-1">点击"登录此用户"或启用模拟模式</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl mb-2">3️⃣</div>
                <Text strong>查看数据</Text>
                <div className="text-sm text-gray-500 mt-1">观察余额、充值记录和使用记录</div>
              </div>
            </Col>
            <Col span={6}>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl mb-2">4️⃣</div>
                <Text strong>验证结果</Text>
                <div className="text-sm text-gray-500 mt-1">确认数据与预期值一致</div>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Current Status */}
        <div className="mb-6">
          <Alert
            message={
              <div className="flex items-center justify-between">
                <span>
                  <ApiOutlined className="mr-2" />
                  当前测试: <Text strong>{currentUser?.displayName}</Text> | 预期余额:{' '}
                  <Text type="success">{currentUser?.expectedBalance}</Text> | 状态:{' '}
                  <Text type={isMockMode ? 'warning' : undefined}>
                    {isMockMode ? '模拟模式' : '实际登录'}
                  </Text>
                </span>
                <Space>
                  <Button type="link" size="small" onClick={() => window.location.reload()}>
                    刷新页面
                  </Button>
                </Space>
              </div>
            }
            type="success"
            showIcon
          />
        </div>

        {/* Main Testing Interface */}
        <div className="space-y-6">
          {/* Credit Balance Section */}
          <CreditBalance key={`balance-${selectedUser}-${isMockMode}`} />

          {/* Credit Recharge History Section */}
          <CreditRechargeHistory key={`recharge-${selectedUser}-${isMockMode}`} />

          {/* Credit Usage History Section */}
          <CreditUsageHistory key={`usage-${selectedUser}-${isMockMode}`} />
        </div>

        {/* Testing Tips */}
        <Card className="mt-8" title="💡 测试提示">
          <Row gutter={16}>
            <Col span={12}>
              <div>
                <Text strong className="block mb-2">
                  重点测试场景：
                </Text>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    <Text strong>Alice (重度用户)</Text>: 验证大量数据的显示和分页
                  </li>
                  <li>
                    <Text strong>Charlie (过期积分)</Text>: 测试过期积分的处理逻辑
                  </li>
                  <li>
                    <Text strong>Zero (零余额)</Text>: 验证零余额状态的展示
                  </li>
                  <li>
                    <Text strong>Diana (企业用户)</Text>: 测试大额积分的显示格式
                  </li>
                </ul>
              </div>
            </Col>
            <Col span={12}>
              <div>
                <Text strong className="block mb-2">
                  两种测试模式：
                </Text>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>
                    <Text strong>实际登录模式</Text>: 点击"登录此用户"进行真实API调用
                  </li>
                  <li>
                    <Text strong>模拟模式</Text>: 快速切换用户查看不同数据，适合UI测试
                  </li>
                  <li>
                    <Text strong>数据对比</Text>: 两种模式可以用来对比验证数据一致性
                  </li>
                  <li>
                    <Text strong>调试信息</Text>: 查看浏览器控制台获取详细的切换日志
                  </li>
                </ul>
              </div>
            </Col>
          </Row>

          <Alert
            message="使用建议"
            description="首次测试建议使用'实际登录模式'验证API功能，然后使用'模拟模式'快速切换不同用户场景进行UI测试。"
            type="info"
            showIcon
            className="mt-4"
          />

          <div className="text-center mt-6">
            <Space size="large">
              <Button
                type="primary"
                icon={<BookOutlined />}
                onClick={() => window.open('/credit-test-validation', '_blank')}
              >
                详细测试方案
              </Button>
              <Button
                icon={<ApiOutlined />}
                onClick={() => window.open('http://localhost:5800/api-docs', '_blank')}
              >
                API 文档
              </Button>
              <Button
                icon={<LinkOutlined />}
                onClick={() => window.open('https://github.com/refly-ai/refly', '_blank')}
              >
                项目仓库
              </Button>
            </Space>
          </div>
        </Card>
      </Content>
    </Layout>
  );
};

export default CreditTestPage;
