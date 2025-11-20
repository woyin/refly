# 🔄 Async Task Polling Guide

本指南说明如何使用新的智能轮询功能来处理异步视频生成等长时间运行的任务。

## 📋 概述

我们已经在 `HttpAdapter` 中实现了**智能轮询机制**，可以自动处理异步 API 任务：

✅ **自动检测任务 ID**（支持 15+ 种常见字段）
✅ **自动检测状态**（支持多种状态字段和值）
✅ **自动下载文件**（递归查找 URL 并下载）
✅ **极简配置**（只需 1 个必填字段）
✅ **兼容所有主流 API**（HeyGen, FAL.ai, Runway, Replicate 等）

---

## 🚀 快速开始

### 1. 配置示例（HeyGen）

在 `tool_methods` 表的 `adapter_config` 字段中添加 `polling` 配置：

```json
{
  "headers": {
    "X-Api-Key": "${HEYGEN_API_KEY}"
  },
  "polling": {
    "statusUrl": "/v1/video_status.get?video_id={id}"
  }
}
```

**就这么简单！** 系统会自动：
- 检测初始响应中的 `video_id`
- 每 5 秒轮询一次状态
- 最多等待 300 秒（5 分钟）
- 检测到完成后自动下载视频

### 2. 自定义超时（可选）

```json
{
  "headers": {
    "X-Api-Key": "${HEYGEN_API_KEY}"
  },
  "polling": {
    "statusUrl": "/v1/video_status.get?video_id={id}",
    "maxWaitSeconds": 600,    // 最多等待 10 分钟
    "intervalSeconds": 3       // 每 3 秒轮询一次
  }
}
```

---

## 📊 支持的 API

### HeyGen
```json
{
  "polling": {
    "statusUrl": "/v1/video_status.get?video_id={id}"
  }
}
```

### FAL.ai
```json
{
  "polling": {
    "statusUrl": "/requests/{id}/status"
  }
}
```

### Runway ML
```json
{
  "polling": {
    "statusUrl": "/v1/tasks/{id}"
  }
}
```

### Replicate
```json
{
  "polling": {
    "statusUrl": "/v1/predictions/{id}"
  }
}
```

---

## 🔧 工作原理

### 1. 自动检测任务 ID

系统会自动尝试以下字段（按顺序）：

```javascript
[
  'id',
  'request_id', 'requestId',
  'video_id', 'videoId',
  'task_id', 'taskId',
  'job_id', 'jobId',
  'prediction_id', 'predictionId',
  'data.id', 'data.video_id', ... // 嵌套路径
]
```

### 2. 自动检测状态

支持的状态字段：
```javascript
['status', 'state', 'data.status', 'data.state', 'task.status']
```

完成状态值（不区分大小写）：
```javascript
['completed', 'success', 'succeeded', 'done']
```

失败状态值：
```javascript
['failed', 'error', 'cancelled', 'canceled']
```

### 3. 自动下载文件

递归查找以下 URL 字段（优先级从高到低）：

```javascript
[
  'video_url', 'videoUrl',
  'audio_url', 'audioUrl',
  'file_url', 'fileUrl',
  'url',
  'download_url', 'downloadUrl',
  'output' // 可能包含嵌套 URL
]
```

找到 URL 后自动下载并返回：
```javascript
{
  ...originalData,
  buffer: Buffer,      // 文件内容
  filename: 'video-{id}.mp4',
  mimetype: 'video/mp4'
}
```

---

## 📝 完整配置参考

### PollingConfig 字段

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `statusUrl` | string | ✅ | - | 状态查询端点模板（使用 `{id}` 作为占位符） |
| `maxWaitSeconds` | number | ❌ | 300 | 最大等待时间（秒） |
| `intervalSeconds` | number | ❌ | 5 | 轮询间隔（秒） |

### URL 模板规则

- 使用 `{id}` 作为任务 ID 的占位符
- 支持路径参数：`/v1/tasks/{id}`
- 支持查询参数：`/v1/status?task_id={id}`
- 系统会自动替换 `{id}` 为检测到的任务 ID

---

## 🎯 使用场景

### 场景 1: 视频生成（HeyGen）

**调用流程：**
```
1. POST /v2/video/generate
   → 返回 { "data": { "video_id": "abc123" } }

2. 自动轮询 GET /v1/video_status.get?video_id=abc123
   → 每 5 秒检查一次

3. 检测到 status = "completed"
   → 自动下载 video_url

4. 返回完整结果（包含 buffer）
```

### 场景 2: 无需下载（仅获取状态）

如果响应中没有可下载的 URL，系统会直接返回原始数据：

```json
{
  "status": "completed",
  "result": {
    "text": "Generated text output"
  }
}
```

---

## 🛠️ 数据库插入

### 方式 1: 直接执行 SQL

```bash
psql -U your_user -d refly < sql-inserts-video-generation.sql
```

### 方式 2: 使用 Prisma Studio

1. `cd apps/api && pnpm prisma studio`
2. 打开 `ToolMethod` 表
3. 手动添加记录，粘贴 JSON 配置

### 方式 3: 通过 API

```typescript
await prisma.toolMethod.create({
  data: {
    inventoryKey: 'heygen',
    versionId: 1,
    name: 'create_avatar_video_v2',
    description: '...',
    endpoint: 'https://api.heygen.com/v2/video/generate',
    httpMethod: 'POST',
    requestSchema: '...',
    responseSchema: '...',
    adapterType: 'http',
    adapterConfig: JSON.stringify({
      headers: {
        'X-Api-Key': '${HEYGEN_API_KEY}'
      },
      polling: {
        statusUrl: '/v1/video_status.get?video_id={id}'
      }
    }),
    enabled: true
  }
});
```

---

## 📦 完整示例

### HeyGen 视频生成

```typescript
// 1. 调用工具
const result = await toolService.executeMethod('heygen', 'create_avatar_video_v2', {
  video_inputs: [{
    character: {
      type: 'avatar',
      avatar_id: 'avatar_001'
    },
    voice: {
      type: 'text',
      voice_id: 'voice_001',
      input_text: 'Hello world!'
    }
  }]
});

// 2. HttpAdapter 自动执行：
//    - POST /v2/video/generate (获取 video_id)
//    - 轮询 GET /v1/video_status.get?video_id=xxx
//    - 检测到 completed
//    - 下载视频文件
//    - 返回 buffer

// 3. 结果包含：
{
  status: 'success',
  data: {
    videoId: 'abc123',
    status: 'completed',
    videoUrl: 'https://...',
    duration: 10.5,
    buffer: Buffer<...>,          // ✅ 已下载
    filename: 'file-abc123.mp4',  // ✅ 自动命名
    mimetype: 'video/mp4'         // ✅ 自动检测
  }
}
```

---

## ⚠️ 注意事项

### 1. 环境变量

确保设置了 API 密钥：

```bash
# .env
HEYGEN_API_KEY=your_actual_key
FAL_API_KEY=your_actual_key
RUNWAY_API_KEY=your_actual_key
REPLICATE_API_TOKEN=your_actual_token
```

### 2. 超时处理

- 默认最大等待 300 秒（5 分钟）
- 如果任务可能需要更长时间，调整 `maxWaitSeconds`
- 轮询超时会抛出 `POLLING_TIMEOUT` 错误

### 3. 错误处理

系统会自动捕获并抛出以下错误：

- `TASK_FAILED`: 任务失败（检测到 failed 状态）
- `POLLING_TIMEOUT`: 轮询超时
- `HTTP_ERROR`: HTTP 请求失败
- `DOWNLOAD_FAILED`: 文件下载失败（会降级返回原始数据）

---

## 🧪 测试

### 测试轮询逻辑

```typescript
// Mock 响应
const initialResponse = { data: { video_id: 'test123' } };
const statusResponse = { data: { status: 'completed', video_url: 'https://...' } };

// 验证自动检测
expect(adapter.autoDetectTaskId(initialResponse)).toBe('test123');
expect(adapter.autoDetectStatus(statusResponse)).toBe('completed');
```

### 日志输出

启用 DEBUG 模式查看详细日志：

```
✅ Task ID detected: data.video_id = abc123
Polling 1/60: /v1/video_status.get?video_id=abc123
Task abc123 status: processing
Polling 2/60: /v1/video_status.get?video_id=abc123
Task abc123 status: completed
✅ Task abc123 completed
🔽 Downloading from: video_url = https://...
✅ Downloaded 5242880 bytes as file-abc123.mp4
```

---

## 🎉 总结

通过这个智能轮询机制，你可以：

1. **极简配置**：只需 1 行 `statusUrl` 配置
2. **零代码改动**：完全通过数据库配置驱动
3. **自动化一切**：任务 ID 检测、状态轮询、文件下载全自动
4. **通用兼容**：支持所有符合 RESTful 规范的异步 API

开始使用吧！🚀
