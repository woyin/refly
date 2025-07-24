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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { selectedUser, currentUser, isMockMode, switchUser, enableMockMode, loginAsTestUser } =
    useMockUser();

  const handleUserSwitch = (userUid: string) => {
    const newUser = TEST_USERS.find((u) => u.uid === userUid);
    message.loading(t('credit.test.switchingUser', { userName: newUser?.displayName }), 1);
    switchUser(userUid);

    // Show success message after data loading
    setTimeout(() => {
      message.success(t('credit.test.switchUserSuccess', { userName: newUser?.displayName }));
    }, 600);
  };

  const handleLoginAsTestUser = async () => {
    if (!currentUser) return;
    message.loading(t('credit.test.loggingIn'), 2.5);
    try {
      const success = await loginAsTestUser(selectedUser);
      if (success) {
        message.success(t('credit.test.loginSuccess', { userName: currentUser.displayName }));
      } else {
        message.error(t('credit.test.loginFailed'));
      }
    } catch (error) {
      message.error(t('credit.test.loginError'));
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
              {t('credit.test.pageTitle')}
            </Title>
          </div>
          <Paragraph className="text-gray-600 text-lg">
            {t('credit.test.pageDescription')}
          </Paragraph>
        </div>

        {/* Test User Selector */}
        <Card
          className="mb-6"
          title={
            <div className="flex items-center gap-2">
              <UserSwitchOutlined className="text-blue-600" />
              <span>{t('credit.test.userSelector')}</span>
            </div>
          }
        >
          <Alert
            message={t('credit.test.quickTestTitle')}
            description={t('credit.test.quickTestDescription')}
            type="info"
            showIcon
            className="mb-4"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="mb-4">
                <label
                  htmlFor="test-user-select"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  {t('credit.test.selectTestUser')}
                </label>
                <Select
                  id="test-user-select"
                  value={selectedUser}
                  onChange={handleUserSwitch}
                  className="w-full"
                  placeholder={t('credit.test.selectUserPlaceholder')}
                >
                  {TEST_USERS.map((user) => (
                    <Option key={user.uid} value={user.uid}>
                      <div className="flex items-center justify-between">
                        <span>{user.displayName}</span>
                        <Text type="secondary" className="text-xs ml-2">
                          {t('credit.test.expectedBalance')}: {user.expectedBalance}
                        </Text>
                      </div>
                    </Option>
                  ))}
                </Select>
              </div>

              <Row gutter={16}>
                <Col span={12}>
                  <Button
                    type="primary"
                    onClick={handleLoginAsTestUser}
                    icon={<LoginOutlined />}
                    className="w-full"
                    disabled={!currentUser}
                  >
                    {t('credit.test.actualLogin')}
                  </Button>
                </Col>
                <Col span={12}>
                  <Button
                    type="default"
                    onClick={() => enableMockMode(true)}
                    icon={<UserSwitchOutlined />}
                    className="w-full"
                  >
                    {t('credit.test.simulationMode')}
                  </Button>
                </Col>
              </Row>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Text strong className="text-blue-600">
                    {t('credit.test.currentMode')}
                  </Text>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      isMockMode ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {isMockMode ? t('credit.test.simulation') : t('credit.test.realMode')}
                  </span>
                </div>
                <Text type="secondary" className="text-sm">
                  {isMockMode
                    ? t('credit.test.simulationDescription')
                    : t('credit.test.realModeDescription')}
                </Text>
              </div>

              {currentUser && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="mb-2">
                    <Text strong className="text-blue-800">
                      {t('credit.test.selectedUser')}
                    </Text>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div>
                      <Text className="text-blue-700">
                        {t('credit.test.userName')}: {currentUser.displayName}
                      </Text>
                    </div>
                    <div>
                      <Text className="text-blue-700">
                        {t('credit.test.userId')}: {currentUser.uid}
                      </Text>
                    </div>
                    <div>
                      <Text className="text-blue-700">
                        {t('credit.test.expectedBalance')}: {currentUser.expectedBalance}{' '}
                        {t('credit.balance.creditsUnit')}
                      </Text>
                    </div>
                    <div>
                      <Text className="text-blue-700">
                        {t('credit.test.scenario')}: {currentUser.scenario}
                      </Text>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Credit Balance */}
        <CreditBalance />

        {/* Credit History */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          <CreditRechargeHistory />
          <CreditUsageHistory />
        </div>

        {/* Testing Info */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <BookOutlined className="text-green-600" />
              <span>{t('credit.test.testingInfo')}</span>
            </div>
          }
          className="mb-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">3</div>
              <div className="text-sm text-blue-800">{t('credit.test.apiEndpoints')}</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">{TEST_USERS.length}</div>
              <div className="text-sm text-green-800">{t('credit.test.testUsers')}</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600 mb-1">5</div>
              <div className="text-sm text-orange-800">{t('credit.test.testScenarios')}</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">2</div>
              <div className="text-sm text-purple-800">{t('credit.test.testModes')}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium mb-3">{t('credit.test.coreFeatures')}</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• {t('credit.test.feature1')}</li>
                <li>• {t('credit.test.feature2')}</li>
                <li>• {t('credit.test.feature3')}</li>
                <li>• {t('credit.test.feature4')}</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-3">{t('credit.test.testingFeatures')}</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>• {t('credit.test.testFeature1')}</li>
                <li>• {t('credit.test.testFeature2')}</li>
                <li>• {t('credit.test.testFeature3')}</li>
                <li>• {t('credit.test.testFeature4')}</li>
              </ul>
            </div>
          </div>

          <Alert
            message={t('credit.test.usageSuggestion')}
            description={t('credit.test.usageSuggestionDesc')}
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
                {t('credit.test.detailedTestPlan')}
              </Button>
              <Button
                icon={<ApiOutlined />}
                onClick={() => window.open('http://localhost:5800/api-docs', '_blank')}
              >
                {t('credit.test.apiDocs')}
              </Button>
              <Button
                icon={<LinkOutlined />}
                onClick={() => window.open('https://github.com/refly-ai/refly', '_blank')}
              >
                {t('credit.test.projectRepo')}
              </Button>
            </Space>
          </div>
        </Card>
      </Content>
    </Layout>
  );
};

export default CreditTestPage;
