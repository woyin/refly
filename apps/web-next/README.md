# Refly Web Next

基于 Rsbuild 的现代化 React 应用。

## 开发指南

### 启动开发服务器

```bash
pnpm dev
```

### 构建生产版本

```bash
pnpm build
```

### 预览构建结果

```bash
pnpm preview
```

## 积分系统测试页面

### 访问路径
```
http://localhost:5173/credit-test
```

### 功能概述

积分系统测试页面提供了完整的积分功能测试界面，包括：

#### 🔍 核心功能
- **积分余额查询**: 实时显示用户可用积分和总充值积分
- **充值记录管理**: 查看历史充值信息、来源、有效期等
- **使用记录分析**: 详细的积分消费记录和使用统计

#### 📡 API 接口测试
- `GET /v1/credit/balance` - 获取积分余额
- `GET /v1/credit/recharge` - 获取充值记录
- `GET /v1/credit/usage` - 获取使用记录

#### 🎯 测试场景
1. **余额查询测试**: 验证积分余额计算逻辑
2. **充值记录测试**: 验证不同来源的充值记录展示
3. **使用记录测试**: 验证各种消费类型的记录统计
4. **错误处理测试**: 验证网络错误和认证失败的处理

#### 💡 使用说明

**前置条件:**
- 用户必须已登录（需要 JWT Token）
- 后端积分系统模块已启动
- 数据库中有相关的积分数据

**测试步骤:**
1. 访问 `/credit-test` 页面
2. 查看积分余额卡片，确认数据加载正常
3. 检查充值记录表格，验证分页和筛选功能
4. 查看使用记录表格，分析消费模式
5. 点击刷新按钮测试数据更新功能
6. 测试网络错误时的重试机制

**数据说明:**
- 积分按5K token为计费单位
- 充值记录有30天有效期
- 积分扣减遵循先进先出(FIFO)原则
- 支持多种使用类型：模型调用、媒体生成、向量化、重排序

#### 🛠️ 开发者注意事项

**组件结构:**
```
src/pages/CreditTestPage.tsx          # 主测试页面
src/components/CreditBalance.tsx      # 积分余额组件
src/components/CreditRechargeHistory.tsx  # 充值记录组件
src/components/CreditUsageHistory.tsx     # 使用记录组件
```

**数据查询:**
- 使用 `@refly-packages/ai-workspace-common` 的查询钩子
- 支持 React Query 的缓存和错误处理
- 提供手动刷新功能

**样式规范:**
- 使用 Tailwind CSS 进行样式设计
- 遵循 Refly 设计系统规范
- 响应式布局支持移动端访问

#### 🐛 故障排除

**常见问题:**
1. **数据无法加载**: 检查用户登录状态和 Token 有效性
2. **API 请求失败**: 确认后端服务运行正常，检查代理配置
3. **样式显示异常**: 确认 Tailwind CSS 配置正确
4. **组件导入错误**: 检查组件路径和导出声明

**调试方法:**
- 使用浏览器开发者工具查看网络请求
- 检查控制台错误信息
- 验证 API 响应数据格式
- 使用 React DevTools 查看组件状态

## 技术栈

- **构建工具**: Rsbuild
- **框架**: React 18
- **路由**: React Router
- **状态管理**: Zustand (通过 @refly/stores)
- **数据获取**: TanStack Query
- **UI 组件**: Ant Design
- **样式**: Tailwind CSS
- **类型检查**: TypeScript 