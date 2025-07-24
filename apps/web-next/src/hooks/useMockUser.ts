import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// 测试用户类型定义
export interface TestUser {
  uid: string;
  name: string;
  email: string;
  displayName: string;
  scenario: string;
  expectedBalance: string;
  description: string;
  color: string;
}

// 测试用户数据
export const TEST_USERS: TestUser[] = [
  {
    uid: 'u-credit-test-001',
    name: 'alice-heavy-user',
    email: 'alice@credittest.refly.ai',
    displayName: 'Alice (重度用户)',
    scenario: 'Heavy user with multiple recharges and high usage',
    expectedBalance: '~22,000',
    description: '多次充值的重度用户，有大量使用记录',
    color: '#1890ff',
  },
  {
    uid: 'u-credit-test-002',
    name: 'bob-new-user',
    email: 'bob@credittest.refly.ai',
    displayName: 'Bob (新用户)',
    scenario: 'New user with first recharge and minimal usage',
    expectedBalance: '~8,500',
    description: '首次充值的新用户，使用较少',
    color: '#52c41a',
  },
  {
    uid: 'u-credit-test-003',
    name: 'charlie-expired',
    email: 'charlie@credittest.refly.ai',
    displayName: 'Charlie (过期积分)',
    scenario: 'User with expired credits and mixed usage',
    expectedBalance: '~3,000',
    description: '有过期积分的用户，适合测试过期逻辑',
    color: '#faad14',
  },
  {
    uid: 'u-credit-test-004',
    name: 'diana-enterprise',
    email: 'diana@credittest.refly.ai',
    displayName: 'Diana (企业用户)',
    scenario: 'Enterprise user with large recharges and diverse usage',
    expectedBalance: '~155,000',
    description: '企业级用户，大额充值和多样化使用',
    color: '#722ed1',
  },
  {
    uid: 'u-credit-test-005',
    name: 'eve-trial',
    email: 'eve@credittest.refly.ai',
    displayName: 'Eve (试用用户)',
    scenario: 'Trial user with promotional credits',
    expectedBalance: '~4,200',
    description: '试用用户，有促销积分，即将过期',
    color: '#eb2f96',
  },
  {
    uid: 'u-credit-test-zero',
    name: 'zero-balance-user',
    email: 'zero@credittest.refly.ai',
    displayName: 'Zero (零余额)',
    scenario: 'User with depleted credits',
    expectedBalance: '0',
    description: '积分已耗尽的用户，测试零余额情况',
    color: '#f5222d',
  },
];

interface MockUserState {
  selectedUser: string;
  currentUser: TestUser | undefined;
  isMockMode: boolean;
  isLoading: boolean; // Add loading state
}

interface MockUserActions {
  switchUser: (userUid: string) => void;
  enableMockMode: () => void;
  disableMockMode: () => void;
  loginAsTestUser: (userUid: string) => Promise<boolean>;
}

/**
 * Mock User Hook
 * 用于在测试环境中快速切换不同的测试用户，避免重复登录
 */
export const useMockUser = (): MockUserState & MockUserActions => {
  const [selectedUser, setSelectedUser] = useState<string>('u-credit-test-001');
  const [isMockMode, setIsMockMode] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false); // Add loading state
  const queryClient = useQueryClient();

  const currentUser = TEST_USERS.find((user) => user.uid === selectedUser);

  useEffect(() => {
    // 检查是否在测试环境
    const isTestEnv =
      window.location.hostname === 'localhost' ||
      window.location.hostname.includes('test') ||
      process.env.NODE_ENV === 'development';

    if (isTestEnv) {
      // 从localStorage恢复上次选择的测试用户
      const savedUser = localStorage.getItem('mock-test-user');
      const savedMockMode = localStorage.getItem('mock-mode') === 'true';

      if (savedUser && TEST_USERS.find((u) => u.uid === savedUser)) {
        setSelectedUser(savedUser);
      }

      if (savedMockMode) {
        setIsMockMode(true);
      }
    }
  }, []);

  const switchUser = (userUid: string) => {
    if (TEST_USERS.find((u) => u.uid === userUid)) {
      const previousUser = selectedUser;
      setIsLoading(true); // Set loading state

      setSelectedUser(userUid);
      localStorage.setItem('mock-test-user', userUid);

      // 清除React Query缓存，强制重新获取新用户的数据
      queryClient.invalidateQueries({
        queryKey: ['GetCreditBalance'],
      });
      queryClient.invalidateQueries({
        queryKey: ['GetCreditRecharge'],
      });
      queryClient.invalidateQueries({
        queryKey: ['GetCreditUsage'],
      });

      // 在控制台输出切换信息，方便调试
      console.log(`🔄 Mock User Switch: ${previousUser} → ${userUid}`, {
        previousUser: TEST_USERS.find((u) => u.uid === previousUser)?.displayName,
        newUser: TEST_USERS.find((u) => u.uid === userUid)?.displayName,
        timestamp: new Date().toISOString(),
        cacheInvalidated: ['GetCreditBalance', 'GetCreditRecharge', 'GetCreditUsage'],
      });

      // 如果启用了模拟模式，可以在这里设置模拟的JWT token
      if (isMockMode) {
        setMockUserContext(userUid);
      }

      // Reset loading state after a short delay to allow queries to start
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  const enableMockMode = () => {
    setIsMockMode(true);
    localStorage.setItem('mock-mode', 'true');
    setMockUserContext(selectedUser);

    console.log('🎭 Mock Mode Enabled', {
      currentUser: currentUser?.displayName,
      availableUsers: TEST_USERS.map((u) => u.displayName),
    });
  };

  const disableMockMode = () => {
    setIsMockMode(false);
    localStorage.setItem('mock-mode', 'false');
    clearMockUserContext();

    console.log('🔒 Mock Mode Disabled');
  };

  const loginAsTestUser = async (userUid: string): Promise<boolean> => {
    try {
      const user = TEST_USERS.find((u) => u.uid === userUid);
      if (!user) {
        console.error('Test user not found:', userUid);
        return false;
      }

      // 这里可以调用实际的登录API
      const response = await fetch('http://localhost:5800/v1/auth/email/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 重要：包含cookies用于认证
        body: JSON.stringify({
          email: user.email,
          password: 'testPassword123',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 登录成功后，清除所有React Query缓存并刷新数据
          queryClient.clear(); // 清除所有缓存

          // 立即重新获取新用户的数据
          queryClient.invalidateQueries({
            queryKey: ['GetCreditBalance'],
          });
          queryClient.invalidateQueries({
            queryKey: ['GetCreditRecharge'],
          });
          queryClient.invalidateQueries({
            queryKey: ['GetCreditUsage'],
          });

          // 切换到当前用户（这也会触发额外的缓存清除）
          switchUser(userUid);

          console.log('✅ Login successful for test user:', user.email, {
            uid: userUid,
            displayName: user.displayName,
            cacheCleared: true,
            timestamp: new Date().toISOString(),
          });

          return true;
        }
      }

      console.error('Login failed for test user:', user.email, await response.json());
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const setMockUserContext = (userUid: string) => {
    // 在模拟模式下，可以设置一个假的JWT token或用户上下文
    // 这个token只在前端使用，不会发送到服务器
    const mockToken = `mock-token-${userUid}-${Date.now()}`;
    sessionStorage.setItem('mock-auth-token', mockToken);
    sessionStorage.setItem('mock-user-uid', userUid);
  };

  const clearMockUserContext = () => {
    sessionStorage.removeItem('mock-auth-token');
    sessionStorage.removeItem('mock-user-uid');
  };

  return {
    // State
    selectedUser,
    currentUser,
    isMockMode,
    isLoading,

    // Actions
    switchUser,
    enableMockMode,
    disableMockMode,
    loginAsTestUser,
  };
};

/**
 * 获取当前模拟用户的认证信息
 */
export const getMockAuthHeaders = (): Record<string, string> => {
  const isMockMode = sessionStorage.getItem('mock-auth-token');
  const realToken = localStorage.getItem('auth-token');

  if (isMockMode && process.env.NODE_ENV === 'development') {
    // 在开发环境下，如果启用了模拟模式，返回模拟的headers
    return {
      Authorization: `Bearer ${isMockMode}`,
      'X-Mock-User': sessionStorage.getItem('mock-user-uid') || '',
    };
  }

  if (realToken) {
    return {
      Authorization: `Bearer ${realToken}`,
    };
  }

  return {};
};

/**
 * 检查当前是否为测试用户
 */
export const isTestUser = (userUid?: string): boolean => {
  if (!userUid) return false;
  return TEST_USERS.some((user) => user.uid === userUid);
};

/**
 * 获取测试用户信息
 */
export const getTestUserInfo = (userUid: string): TestUser | undefined => {
  return TEST_USERS.find((user) => user.uid === userUid);
};
