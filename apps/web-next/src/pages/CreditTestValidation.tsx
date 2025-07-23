import React, { useState } from 'react';
import {
  Layout,
  Typography,
  Card,
  Steps,
  Alert,
  Button,
  Space,
  Tag,
  Collapse,
  Table,
  Row,
  Col,
} from 'antd';
import {
  CheckCircleOutlined,
  InfoCircleOutlined,
  BugOutlined,
  DatabaseOutlined,
  ApiOutlined,
  UserOutlined,
  HistoryOutlined,
} from '@ant-design/icons';

const { Content } = Layout;
const { Title, Paragraph, Text } = Typography;
const { Step } = Steps;
const { Panel } = Collapse;

/**
 * Credit System Test Validation Page
 * 积分系统测试验证页面 - 提供完整的测试方案和数据对比验证
 */
const CreditTestValidation: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);

  // 测试用户数据
  const testUsers = [
    {
      uid: 'u-credit-test-001',
      name: 'alice-heavy-user',
      email: 'alice@credittest.refly.ai',
      scenario: 'Heavy user with multiple recharges and high usage',
      expectedRecharges: 3,
      expectedUsages: '150-300',
      expectedBalance: '22000',
      testPassword: 'testPassword123',
    },
    {
      uid: 'u-credit-test-002',
      name: 'bob-new-user',
      email: 'bob@credittest.refly.ai',
      scenario: 'New user with first recharge and minimal usage',
      expectedRecharges: 1,
      expectedUsages: '5-15',
      expectedBalance: '8500',
      testPassword: 'testPassword123',
    },
    {
      uid: 'u-credit-test-003',
      name: 'charlie-expired',
      email: 'charlie@credittest.refly.ai',
      scenario: 'User with expired credits and mixed usage',
      expectedRecharges: 2,
      expectedUsages: '50-100',
      expectedBalance: '3000',
      testPassword: 'testPassword123',
    },
    {
      uid: 'u-credit-test-004',
      name: 'diana-enterprise',
      email: 'diana@credittest.refly.ai',
      scenario: 'Enterprise user with large recharges and diverse usage',
      expectedRecharges: 2,
      expectedUsages: '400-800',
      expectedBalance: '155000',
      testPassword: 'testPassword123',
    },
    {
      uid: 'u-credit-test-005',
      name: 'eve-trial',
      email: 'eve@credittest.refly.ai',
      scenario: 'Trial user with promotional credits',
      expectedRecharges: 1,
      expectedUsages: '3-8',
      expectedBalance: '4200',
      testPassword: 'testPassword123',
    },
    {
      uid: 'u-credit-test-zero',
      name: 'zero-balance-user',
      email: 'zero@credittest.refly.ai',
      scenario: 'User with depleted credits',
      expectedRecharges: 1,
      expectedUsages: '~50',
      expectedBalance: '0',
      testPassword: 'testPassword123',
    },
  ];

  // API测试用例
  const apiTestCases = [
    {
      method: 'GET',
      endpoint: '/v1/credit/balance',
      description: '获取用户积分余额',
      expectedFields: ['creditAmount', 'creditUsage'],
      testScenarios: [
        'Normal user with active credits',
        'User with expired credits',
        'User with zero balance',
        'Enterprise user with large balance',
      ],
    },
    {
      method: 'GET',
      endpoint: '/v1/credit/recharge',
      description: '获取用户充值记录',
      expectedFields: ['rechargeId', 'amount', 'balance', 'source', 'enabled', 'expiresAt'],
      testScenarios: [
        'User with multiple recharge sources',
        'User with expired recharges',
        'New user with single recharge',
        'User with promotional credits',
      ],
    },
    {
      method: 'GET',
      endpoint: '/v1/credit/usage',
      description: '获取用户使用记录',
      expectedFields: ['usageId', 'amount', 'usageType', 'modelName', 'createdAt'],
      testScenarios: [
        'User with diverse usage types',
        'User with model_call usage only',
        'User with media_generation usage',
        'User with minimal usage history',
      ],
    },
  ];

  // 测试步骤
  const testSteps = [
    {
      title: '环境准备',
      description: '确保测试环境已正确配置',
      icon: <DatabaseOutlined />,
    },
    {
      title: '数据验证',
      description: '验证测试数据已正确生成',
      icon: <CheckCircleOutlined />,
    },
    {
      title: 'API测试',
      description: '测试所有积分相关API接口',
      icon: <ApiOutlined />,
    },
    {
      title: '前端验证',
      description: '验证前端页面正确显示数据',
      icon: <UserOutlined />,
    },
    {
      title: '边界测试',
      description: '测试各种边界条件和异常情况',
      icon: <BugOutlined />,
    },
  ];

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
  };

  const testUserColumns = [
    {
      title: '用户名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '测试场景',
      dataIndex: 'scenario',
      key: 'scenario',
    },
    {
      title: '预期充值记录',
      dataIndex: 'expectedRecharges',
      key: 'expectedRecharges',
      render: (num: number) => <Tag color="blue">{num}</Tag>,
    },
    {
      title: '预期使用记录',
      dataIndex: 'expectedUsages',
      key: 'expectedUsages',
      render: (range: string) => <Tag color="green">{range}</Tag>,
    },
    {
      title: '预期余额',
      dataIndex: 'expectedBalance',
      key: 'expectedBalance',
      render: (balance: string) => <Tag color="orange">{balance} credits</Tag>,
    },
  ];

  const apiTestColumns = [
    {
      title: 'API接口',
      dataIndex: 'endpoint',
      key: 'endpoint',
      render: (endpoint: string, record: any) => (
        <Space>
          <Tag color="processing">{record.method}</Tag>
          <Text code>{endpoint}</Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '预期字段',
      dataIndex: 'expectedFields',
      key: 'expectedFields',
      render: (fields: string[]) => (
        <Space wrap>
          {fields.map((field) => (
            <Tag key={field} color="default">
              {field}
            </Tag>
          ))}
        </Space>
      ),
    },
  ];

  return (
    <Layout className="min-h-screen bg-gray-50">
      <Content className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <BugOutlined className="text-2xl text-green-600" />
            <Title level={2} className="!mb-0">
              积分系统测试验证方案
            </Title>
          </div>
          <Paragraph className="text-gray-600 text-lg">
            完整的积分系统功能测试、数据验证和质量保证方案
          </Paragraph>
        </div>

        {/* Quick Stats */}
        <Row gutter={16} className="mb-8">
          <Col span={6}>
            <Card className="text-center">
              <div className="text-2xl font-bold text-blue-600">6</div>
              <div className="text-gray-500">测试用户</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="text-center">
              <div className="text-2xl font-bold text-green-600">3</div>
              <div className="text-gray-500">API接口</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="text-center">
              <div className="text-2xl font-bold text-orange-600">10</div>
              <div className="text-gray-500">充值记录</div>
            </Card>
          </Col>
          <Col span={6}>
            <Card className="text-center">
              <div className="text-2xl font-bold text-purple-600">758</div>
              <div className="text-gray-500">使用记录</div>
            </Card>
          </Col>
        </Row>

        {/* Test Progress */}
        <Card className="mb-8">
          <Title level={4} className="mb-4">
            测试执行步骤
          </Title>
          <Steps current={currentStep} onChange={handleStepClick} className="mb-6">
            {testSteps.map((step, index) => (
              <Step
                key={index}
                title={step.title}
                description={step.description}
                icon={step.icon}
              />
            ))}
          </Steps>
        </Card>

        {/* Detailed Test Content */}
        <div className="space-y-6">
          {/* Environment Setup */}
          <Card title="🔧 环境准备检查清单" className="mb-6">
            <div className="space-y-4">
              <Alert
                message="前置条件"
                description="在开始测试之前，请确保以下条件已满足："
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Text strong>后端服务</Text>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>API服务运行在端口 5800</li>
                    <li>PostgreSQL数据库连接正常</li>
                    <li>积分模块已启用 (CreditModule)</li>
                    <li>测试数据已通过脚本生成</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <Text strong>前端服务</Text>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Web-Next服务运行在端口 5173</li>
                    <li>积分测试页面可访问</li>
                    <li>API请求配置正确</li>
                    <li>认证系统工作正常</li>
                  </ul>
                </div>
              </div>
            </div>
          </Card>

          {/* Test Users */}
          <Card title="👥 测试用户数据" className="mb-6">
            <Alert
              message="测试账户信息"
              description="以下是为积分系统测试创建的专用测试账户，每个账户代表不同的使用场景"
              type="success"
              showIcon
              className="mb-4"
            />
            <Table
              dataSource={testUsers}
              columns={testUserColumns}
              rowKey="uid"
              pagination={false}
              size="middle"
            />
            <Alert
              message="登录说明"
              description="所有测试用户的密码均为: testPassword123"
              type="warning"
              showIcon
              className="mt-4"
            />
          </Card>

          {/* API Testing */}
          <Card title="🔌 API接口测试" className="mb-6">
            <Table
              dataSource={apiTestCases}
              columns={apiTestColumns}
              rowKey="endpoint"
              pagination={false}
              expandable={{
                expandedRowRender: (record) => (
                  <div className="pl-4">
                    <Text strong>测试场景:</Text>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      {record.testScenarios.map((scenario: string, index: number) => (
                        <li key={index} className="text-sm">
                          {scenario}
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
                rowExpandable: () => true,
              }}
            />
          </Card>

          {/* Testing Procedures */}
          <Card title="📋 详细测试流程" className="mb-6">
            <Collapse defaultActiveKey={['1']}>
              <Panel header="1. 数据库验证" key="1" extra={<DatabaseOutlined />}>
                <div className="space-y-4">
                  <div>
                    <Text strong>验证测试数据完整性:</Text>
                    <pre className="bg-gray-100 p-3 rounded mt-2 text-sm overflow-x-auto">
                      {`-- 检查测试用户
SELECT COUNT(*) FROM users WHERE uid LIKE 'u-credit-test-%';
-- 预期结果: 6

-- 检查充值记录
SELECT COUNT(*) FROM credit_recharges WHERE uid LIKE 'u-credit-test-%';
-- 预期结果: 10

-- 检查使用记录
SELECT COUNT(*) FROM credit_usages WHERE uid LIKE 'u-credit-test-%';
-- 预期结果: 758

-- 验证积分余额计算
SELECT 
  uid,
  SUM(CASE WHEN enabled = true AND expires_at > NOW() THEN balance ELSE 0 END) as current_balance
FROM credit_recharges 
WHERE uid LIKE 'u-credit-test-%'
GROUP BY uid;`}
                    </pre>
                  </div>
                </div>
              </Panel>

              <Panel header="2. API功能测试" key="2" extra={<ApiOutlined />}>
                <div className="space-y-4">
                  <div>
                    <Text strong>使用curl命令测试API:</Text>
                    <pre className="bg-gray-100 p-3 rounded mt-2 text-sm overflow-x-auto">
                      {`# 获取积分余额
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
     http://localhost:5800/v1/credit/balance

# 获取充值记录
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
     http://localhost:5800/v1/credit/recharge

# 获取使用记录  
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
     http://localhost:5800/v1/credit/usage`}
                    </pre>
                  </div>
                  <Alert
                    message="认证说明"
                    description="需要使用测试用户账户登录获取有效的JWT Token"
                    type="info"
                    showIcon
                  />
                </div>
              </Panel>

              <Panel header="3. 前端页面测试" key="3" extra={<UserOutlined />}>
                <div className="space-y-4">
                  <div>
                    <Text strong>前端测试步骤:</Text>
                    <ol className="list-decimal list-inside mt-2 space-y-2">
                      <li>
                        访问积分测试页面: <Text code>http://localhost:5173/credit-test</Text>
                      </li>
                      <li>使用测试用户账户登录</li>
                      <li>验证积分余额卡片数据显示正确</li>
                      <li>检查充值记录表格的分页和筛选功能</li>
                      <li>验证使用记录的统计和展示</li>
                      <li>测试刷新按钮和错误处理</li>
                    </ol>
                  </div>
                  <Alert
                    message="UI验证要点"
                    description="确保所有数据正确显示，用户界面响应流畅，错误状态处理得当"
                    type="success"
                    showIcon
                  />
                </div>
              </Panel>

              <Panel header="4. 边界条件测试" key="4" extra={<BugOutlined />}>
                <div className="space-y-4">
                  <div>
                    <Text strong>边界测试场景:</Text>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>零余额用户 (u-credit-test-zero)</li>
                      <li>过期积分处理 (charlie-expired)</li>
                      <li>大量数据展示 (diana-enterprise)</li>
                      <li>网络错误重试机制</li>
                      <li>认证失败处理</li>
                      <li>数据加载状态</li>
                    </ul>
                  </div>
                </div>
              </Panel>

              <Panel header="5. 性能测试" key="5" extra={<HistoryOutlined />}>
                <div className="space-y-4">
                  <div>
                    <Text strong>性能验证:</Text>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>API响应时间 (&lt; 500ms)</li>
                      <li>大数据量表格渲染</li>
                      <li>分页加载性能</li>
                      <li>内存使用情况</li>
                      <li>并发请求处理</li>
                    </ul>
                  </div>
                </div>
              </Panel>
            </Collapse>
          </Card>

          {/* Expected Results */}
          <Card title="✅ 预期结果验证" className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Text strong className="block mb-2">
                  数据一致性验证:
                </Text>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>数据库中的积分余额与API返回一致</li>
                  <li>前端显示的数据与API响应一致</li>
                  <li>充值记录的有效期处理正确</li>
                  <li>使用记录的分类统计准确</li>
                </ul>
              </div>
              <div>
                <Text strong className="block mb-2">
                  功能完整性验证:
                </Text>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>所有API接口正常响应</li>
                  <li>数据分页和筛选功能正常</li>
                  <li>错误状态正确处理和显示</li>
                  <li>用户界面交互流畅</li>
                </ul>
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <Card className="text-center">
            <Space size="large">
              <Button
                type="primary"
                size="large"
                onClick={() => window.open('/credit-test', '_blank')}
              >
                🚀 开始测试积分系统
              </Button>
              <Button
                size="large"
                onClick={() => window.open('http://localhost:5800/api-docs', '_blank')}
              >
                📚 API文档
              </Button>
              <Button size="large" onClick={() => window.location.reload()}>
                🔄 刷新页面
              </Button>
            </Space>
          </Card>
        </div>
      </Content>
    </Layout>
  );
};

export default CreditTestValidation;
