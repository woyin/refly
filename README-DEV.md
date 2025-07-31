# Refly 开发环境设置

## 环境要求

- macOS (已测试)
- Node.js v20.x
- pnpm v9.x

## 快速开始

### 1. 设置环境变量

每次开始开发前，运行以下命令来设置环境：

```bash
./setup-env.sh
```

这个脚本会：
- 加载 nvm (Node Version Manager)
- 设置 Node.js 环境
- 配置 pnpm 使用中国镜像源
- 显示当前版本信息

### 2. 安装依赖

```bash
pnpm install
```

### 3. 开发命令

```bash
# 启动开发服务器
pnpm dev

# 构建项目
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint

# 代码格式化
pnpm format
```

## 项目结构

```
refly/
├── apps/                    # 应用程序
│   ├── api/                # 后端 API (NestJS)
│   ├── web/                # 前端 Web 应用
│   ├── web-next/           # Next.js 版本
│   ├── desktop/            # 桌面应用 (Electron)
│   └── extension/          # 浏览器扩展
├── packages/               # 共享包
│   ├── ai-workspace-common/ # AI 工作空间组件
│   ├── common-types/       # 共享类型定义
│   ├── i18n/              # 国际化资源
│   └── utils/             # 工具函数
└── docs/                  # 文档
```

## 常用命令

### 开发
- `pnpm dev` - 启动所有应用的开发服务器
- `pnpm dev:web` - 只启动 Web 应用
- `pnpm dev:api` - 只启动 API 服务器

### 构建
- `pnpm build` - 构建所有应用
- `pnpm build:web` - 构建 Web 应用
- `pnpm build:api` - 构建 API

### 测试
- `pnpm test` - 运行所有测试
- `pnpm test:e2e` - 运行端到端测试

### 代码质量
- `pnpm lint` - 代码检查
- `pnpm format` - 代码格式化
- `pnpm type-check` - 类型检查

## 故障排除

### 如果遇到网络问题
项目已配置使用中国镜像源，如果仍有问题，可以尝试：

```bash
# 清除缓存
pnpm store prune

# 重新安装
pnpm install --force
```

### 如果 Node.js 版本不匹配
```bash
# 使用 nvm 安装正确的 Node.js 版本
nvm install 20
nvm use 20
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。 