# LLM Context Length Overflow Analysis

## Error Summary

```
Error: 400 This endpoint's maximum context length is 1048576 tokens.
However, you requested about 1293741 tokens
```

**超出情况**：
- 🚫 模型限制：1,048,576 tokens (~1M tokens)
- ⚠️ 实际请求：1,293,741 tokens (~1.29M tokens)
- 📊 超出量：245,165 tokens (~23% 超出)

**Token 分布**：
- 📝 文本输入：1,227,853 tokens (95%)
- 🔧 工具输入：353 tokens (<1%)
- 📤 输出预留：65,535 tokens (5%)

## 问题根源

从错误堆栈可以看出：
```
at SkillEngineService → Agent skill execution
at OpenAI.makeRequest (openai/src/client.ts:713:24)
POST /v1/skill/streamInvoke
```

**核心问题**：Agent skill 在构建 LLM 请求时，将过多的上下文信息传递给了模型。

## 代码分析

### 1. 消息构建流程

#### 文件：[packages/skill-template/src/scheduler/utils/message.ts](../../../../../../packages/skill-template/src/scheduler/utils/message.ts:52-128)

```typescript
export const buildFinalRequestMessages = ({
  module,
  locale,
  chatHistory,        // ⚠️ 可能很长
  messages,           // ⚠️ 额外消息
  context,            // ⚠️ 上下文字符串
  images,
  originalQuery,
  optimizedQuery,
  rewrittenQueries,
  modelInfo,
  customInstructions,
}) => {
  const systemPrompt = module.buildSystemPrompt(locale, !!context);
  const contextUserPrompt = module.buildContextUserPrompt?.(context, !!context);
  const userPrompt = module.buildUserPrompt({
    originalQuery,
    optimizedQuery,
    rewrittenQueries,
    locale,
    customInstructions,
  });

  // 组装所有消息
  const requestMessages = [
    new SystemMessage(systemPrompt),     // 系统提示
    ...chatHistory,                      // ⚠️ 历史对话 - 可能非常长
    ...messages,                         // ⚠️ 额外消息
    ...contextMessages,                  // ⚠️ 上下文消息 - 可能非常长
    finalUserMessage,                    // 当前查询
  ];

  return requestMessages;
};
```

**问题点**：
1. ❌ `chatHistory` - 没有长度限制，可能包含几十甚至上百条消息
2. ❌ `context` - 没有有效压缩，可能包含大量文档内容
3. ❌ `messages` - 额外消息累积

### 2. 上下文准备流程

#### 文件：[packages/skill-template/src/scheduler/utils/context.ts](../../../../../../packages/skill-template/src/scheduler/utils/context.ts:222-425)

```typescript
export async function prepareContext(
  query: string,
  context: SkillContext,
  options: {
    maxTokens: number;           // ⚠️ 关键参数
    engine: SkillEngine;
    summarizerConcurrentLimit?: number;
  },
): Promise<{ contextStr: string }> {
  // ... 构建 blocks ...

  const contextStr = sections.length > 0
    ? `# Context\n\n${sections.join('\n\n')}`
    : '';

  if (maxTokens <= 0) {
    return { contextStr };        // ⚠️ 如果 maxTokens = 0，直接返回未压缩内容
  }

  const totalTokens = encode(contextStr ?? '').length;
  if (totalTokens <= maxTokens) {
    return { contextStr };
  }

  // Middle-out compression
  return await compressContext(query, contextStr, blocks, options);
}
```

**关键发现**：
- ✅ 系统有 `compressContext` 压缩机制
- ⚠️ 但仅在 `maxTokens > 0` 且 `totalTokens > maxTokens` 时才启用
- ❌ 如果 `maxTokens` 参数设置不当或为 0，压缩不会生效

### 3. 上下文压缩算法

#### Middle-Out Compression

```typescript
const compressContext = async (
  query: string,
  contextStr: string,
  blocks: Block[],
  options: { maxTokens: number; engine: SkillEngine; },
) => {
  // 1. 找到可压缩的 blocks（body 非空）
  const compressibleIndexes = blocks
    .map((b, i) => ({ i, tokens: encode(b.body ?? '').length }))
    .filter((x) => x.tokens > 0)
    .map((x) => x.i);

  // 2. 生成 middle-out 顺序（从中间向两端）
  const center = Math.floor((N - 1) / 2);
  // ... 生成压缩顺序 ...

  // 3. 迭代压缩中间的 blocks，直到符合预算
  for (const idx of compressOrder) {
    if (currentTokens <= maxTokens) break;

    // 使用 LLM 压缩 body 内容到 ~30% 或 15% 预算
    const targetBodyBudget = Math.max(
      64,
      Math.floor(Math.min(bodyTokens * 0.3, maxTokens * 0.15))
    );

    const summarized = await summarizer(
      summarizerModel,
      query,
      original?.body ?? '',
      targetBodyBudget,
    );
    currentBlocks[idx] = { ...original, body: summarized ?? '' };
  }

  // 4. 如果仍超出预算，强制 fallback 截断
  if (currentTokens > maxTokens) {
    const trimmed = await fallbackSummarize(query, currentStr, maxTokens);
    return { contextStr: trimmed };
  }

  return { contextStr: currentStr };
};
```

**算法特点**：
- ✅ 智能 middle-out 顺序：优先保留开头和结尾的上下文
- ✅ 使用 LLM 进行语义压缩（保留关键信息）
- ✅ Fallback 机制：如果压缩后仍超出，使用 token-based 截断

### 4. 上下文来源分析

上下文可能包含以下类型（按 token 占用排序）：

```typescript
// 1. Knowledge Base Documents - ⚠️ 高风险
if (context?.documents?.length > 0) {
  // 每个文档可能包含几千到几万 tokens
  const items = context.documents.map(item => ({
    section: 'Knowledge Base Documents',
    body: doc?.content ?? '',  // ⚠️ 完整文档内容
  }));
}

// 2. User Selected Content - ⚠️ 高风险
if (context?.contentList?.length > 0) {
  // 用户选择的内容可能非常长
  const items = context.contentList.map(item => ({
    section: 'User Selected Content',
    body: item?.content ?? '',  // ⚠️ 完整内容
  }));
}

// 3. Previous Agent Results - ⚠️ 中等风险
if (context?.results?.length > 0) {
  const items = context.results.map(item => ({
    section: 'Previous Agent Results',
    body: result?.steps?.map(step => step.content).join('\n\n'),
  }));
}

// 4. Code Artifacts - ⚠️ 中等风险
if (context?.codeArtifacts?.length > 0) {
  const items = context.codeArtifacts.map(item => ({
    section: 'Code Artifacts',
    body: artifact?.content ?? '',  // 代码可能很长
  }));
}

// 5. Files - ⚠️ 中等风险
if (context?.files?.length > 0) {
  const items = context.files.map(item => ({
    section: 'Files',
    body: file?.content ?? '',
  }));
}
```

## 问题定位

### 最可能的原因（按优先级排序）

#### 1. **maxTokens 参数设置不当** 🔥 (最高优先级)

**位置**：调用 `prepareContext` 时
```typescript
// ❌ 错误：maxTokens = 0 或未设置
const { contextStr } = await prepareContext(query, context, {
  maxTokens: 0,  // ⚠️ 或者未传递
  engine,
});

// ✅ 正确：设置合理的 maxTokens
const { contextStr } = await prepareContext(query, context, {
  maxTokens: 300000,  // 例如：为上下文预留 300K tokens
  engine,
});
```

**检查方法**：在 Agent skill 代码中查找 `prepareContext` 调用

#### 2. **chatHistory 未截断** 🔥 (高优先级)

**位置**：`buildFinalRequestMessages` 中
```typescript
const requestMessages = [
  new SystemMessage(systemPrompt),
  ...chatHistory,  // ⚠️ 可能包含几百条消息
  ...messages,
  ...contextMessages,
  finalUserMessage,
];
```

**解决方案**：需要限制 chatHistory 的长度
```typescript
// ✅ 只保留最近 N 条消息
const recentHistory = chatHistory.slice(-10);  // 只保留最近 10 条

const requestMessages = [
  new SystemMessage(systemPrompt),
  ...recentHistory,  // ✅ 使用截断后的历史
  ...messages,
  ...contextMessages,
  finalUserMessage,
];
```

#### 3. **知识库检索返回过多文档** ⚠️ (中等优先级)

**位置**：RAG 检索逻辑
```typescript
// ❌ 返回几十个文档
const documents = await retrieveDocuments(query, {
  topK: 50,  // ⚠️ 太多了
});

// ✅ 限制文档数量
const documents = await retrieveDocuments(query, {
  topK: 5,   // ✅ 更合理
});
```

#### 4. **Canvas 上下文过大** ⚠️ (中等优先级)

**位置**：Canvas 节点和资源收集
```typescript
// 可能收集了大量节点的输出结果
const canvasContext = {
  nodes: [...],      // 几十个节点
  resources: [...],  // 大量资源
};
```

## 诊断步骤

### 步骤 1：添加日志监控

在关键位置添加 token 计数日志：

```typescript
// 在 prepareContext 中
export async function prepareContext(
  query: string,
  context: SkillContext,
  options: { maxTokens: number; engine: SkillEngine },
) {
  // ... 构建 contextStr ...

  const totalTokens = encode(contextStr ?? '').length;

  // ✅ 添加日志
  options.engine.logger.log(
    `[Context Debug] Total context tokens: ${totalTokens}, ` +
    `maxTokens: ${options.maxTokens}, ` +
    `will compress: ${totalTokens > options.maxTokens && options.maxTokens > 0}`
  );

  // ... 压缩逻辑 ...
}

// 在 buildFinalRequestMessages 中
export const buildFinalRequestMessages = ({
  chatHistory,
  messages,
  context,
  // ...
}) => {
  const requestMessages = [/* ... */];

  // ✅ 添加日志
  const totalTokens = requestMessages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);
    return sum + encode(content).length;
  }, 0);

  console.log(
    `[Message Debug] Total message tokens: ${totalTokens}, ` +
    `chatHistory: ${chatHistory.length} msgs, ` +
    `context length: ${encode(context).length} tokens`
  );

  return requestMessages;
};
```

### 步骤 2：检查配置

查找以下文件中的配置：

1. **Agent skill 实现**
   ```bash
   # 检查 maxTokens 参数
   grep -n "prepareContext" packages/skill-template/src/skills/agent.ts
   grep -n "maxTokens" packages/skill-template/src/skills/agent.ts
   ```

2. **Skill engine 配置**
   ```bash
   # 检查模型配置
   grep -n "contextLength\|maxTokens" apps/api/src/modules/skill/
   ```

### 步骤 3：验证压缩是否生效

临时修改代码，强制压缩：

```typescript
// 在 prepareContext 中
export async function prepareContext(
  query: string,
  context: SkillContext,
  options: { maxTokens: number; engine: SkillEngine },
) {
  // ... 构建 contextStr ...

  const totalTokens = encode(contextStr ?? '').length;

  // ✅ 强制压缩（用于测试）
  const forceMaxTokens = Math.min(
    options.maxTokens || 300000,
    300000  // 强制上限 300K
  );

  if (totalTokens > forceMaxTokens) {
    options.engine.logger.warn(
      `[Context Compression] Forcing compression from ${totalTokens} to ${forceMaxTokens} tokens`
    );
    return await compressContext(query, contextStr, blocks, {
      ...options,
      maxTokens: forceMaxTokens,
    });
  }

  return { contextStr };
}
```

## 解决方案

### 方案 1：设置合理的 maxTokens（推荐）

找到调用 `prepareContext` 的地方，确保设置了合理的 `maxTokens`：

```typescript
// 文件：packages/skill-template/src/skills/agent.ts

const { contextStr } = await prepareContext(query, context, {
  // ✅ 为上下文预留合理的 token 预算
  // 模型总限制：1,048,576 tokens
  // - 系统提示：~5,000 tokens
  // - 对话历史：~50,000 tokens (保留最近 10-20 条)
  // - 用户查询：~1,000 tokens
  // - 输出预留：65,535 tokens
  // = 剩余可用：~926,000 tokens
  // 保守估计，为上下文分配 300K-500K tokens
  maxTokens: 300000,  // 300K tokens for context
  engine,
});
```

### 方案 2：截断 chatHistory

在构建消息时限制历史长度：

```typescript
// 文件：packages/skill-template/src/scheduler/utils/message.ts

export const buildFinalRequestMessages = ({
  module,
  locale,
  chatHistory,
  messages,
  context,
  // ...
}) => {
  // ✅ 限制 chatHistory 长度
  const MAX_HISTORY_MESSAGES = 20;
  const recentHistory = chatHistory?.slice(-MAX_HISTORY_MESSAGES) ?? [];

  // ✅ 或者基于 token 预算截断
  const truncatedHistory = truncateHistoryByTokens(chatHistory, 50000);

  const requestMessages = [
    new SystemMessage(systemPrompt),
    ...truncatedHistory,  // ✅ 使用截断后的历史
    ...messages,
    ...contextMessages,
    finalUserMessage,
  ];

  return requestMessages;
};

// 辅助函数：按 token 预算截断历史
function truncateHistoryByTokens(
  history: BaseMessage[],
  maxTokens: number
): BaseMessage[] {
  let totalTokens = 0;
  const result: BaseMessage[] = [];

  // 从最新的消息开始向前累积
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);
    const tokens = encode(content).length;

    if (totalTokens + tokens > maxTokens) {
      break;
    }

    totalTokens += tokens;
    result.unshift(msg);
  }

  return result;
}
```

### 方案 3：智能上下文选择

优先选择最相关的上下文：

```typescript
// 文件：packages/skill-template/src/scheduler/utils/context.ts

export async function prepareContext(
  query: string,
  context: SkillContext,
  options: { maxTokens: number; engine: SkillEngine },
) {
  // ✅ 对各类上下文进行优先级排序
  const allBlocks: Array<Block & { priority: number }> = [];

  // 高优先级：用户选择的内容
  if (context?.contentList?.length > 0) {
    const items = context.contentList.map((item, index) => ({
      section: 'User Selected Content',
      prefix: `### ${item.metadata?.title || 'Content'}\n\n`,
      body: item?.content ?? '',
      suffix: '',
      priority: 100 - index,  // ✅ 高优先级
    }));
    allBlocks.push(...items);
  }

  // 中优先级：知识库文档（按相关度排序）
  if (context?.documents?.length > 0) {
    const items = context.documents
      .sort((a, b) => (b.score || 0) - (a.score || 0))  // ✅ 按相关度排序
      .slice(0, 5)  // ✅ 只取前 5 个最相关的
      .map((item, index) => ({
        section: 'Knowledge Base Documents',
        prefix: `### ${item.document?.title}\n\n`,
        body: item.document?.content ?? '',
        suffix: '',
        priority: 80 - index,  // ✅ 中优先级
      }));
    allBlocks.push(...items);
  }

  // 低优先级：其他资源
  // ...

  // ✅ 按优先级排序
  allBlocks.sort((a, b) => b.priority - a.priority);

  // ✅ 逐个添加 blocks，直到达到 token 预算
  const selectedBlocks: Block[] = [];
  let currentTokens = 0;

  for (const block of allBlocks) {
    const blockTokens = encode(
      `${block.prefix}${block.body}${block.suffix}`
    ).length;

    if (currentTokens + blockTokens > options.maxTokens) {
      // 如果添加这个 block 会超出预算，尝试压缩它
      const remainingBudget = options.maxTokens - currentTokens;
      if (remainingBudget > 1000) {  // 至少 1K tokens 才值得压缩
        const compressed = await summarizer(
          engine.chatModel({ temperature: 0 }, 'queryAnalysis'),
          query,
          block.body,
          remainingBudget * 0.8,  // 使用 80% 的剩余预算
        );
        selectedBlocks.push({
          ...block,
          body: compressed,
        });
        currentTokens += encode(compressed).length;
      }
      break;
    }

    selectedBlocks.push(block);
    currentTokens += blockTokens;
  }

  // 渲染选中的 blocks
  const contextStr = renderAll(selectedBlocks);
  return { contextStr };
}
```

### 方案 4：动态预算分配

根据模型限制动态计算预算：

```typescript
// 文件：packages/skill-template/src/skills/agent.ts

const calculateContextBudget = (
  modelConfig: LLMModelConfig,
  chatHistory: BaseMessage[],
  systemPromptLength: number,
) => {
  // 模型的总 token 限制
  const modelMaxTokens = modelConfig.contextLength || 1048576;

  // 预留给各部分的 tokens
  const reservedForOutput = 65535;  // 输出预留
  const systemPromptTokens = encode(systemPromptLength).length;

  // 估算 chatHistory tokens
  const historyTokens = chatHistory.reduce((sum, msg) => {
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content);
    return sum + encode(content).length;
  }, 0);

  // 预留给其他消息
  const reservedForOther = 10000;

  // 计算可用于上下文的 tokens
  const availableForContext = Math.max(
    50000,  // 至少 50K
    modelMaxTokens - reservedForOutput - systemPromptTokens - historyTokens - reservedForOther
  );

  return Math.min(availableForContext, 500000);  // 最多 500K
};

// 使用动态预算
const contextBudget = calculateContextBudget(
  modelConfig,
  chatHistory,
  systemPrompt.length,
);

const { contextStr } = await prepareContext(query, context, {
  maxTokens: contextBudget,
  engine,
});
```

## 立即行动建议

### 🚨 紧急修复（临时）

1. **找到并修改 Agent skill 中的 `prepareContext` 调用**
   ```typescript
   // 临时硬编码一个安全的 maxTokens
   const { contextStr } = await prepareContext(query, context, {
     maxTokens: 200000,  // ✅ 临时固定为 200K
     engine,
   });
   ```

2. **截断 chatHistory**
   ```typescript
   // 临时限制历史消息数量
   const recentHistory = chatHistory.slice(-15);  // 只保留最近 15 条
   ```

### 🔧 长期优化

1. **实现智能预算分配系统**
   - 根据模型限制动态计算
   - 监控实际 token 使用情况
   - 记录日志用于调优

2. **优化上下文选择策略**
   - 按相关度排序
   - 优先级机制
   - 智能压缩

3. **添加监控和告警**
   - Token 使用率监控
   - 超出警告日志
   - 性能指标收集

## 验证修复

修复后，应该能看到：

```
✅ Total context tokens: 250000, maxTokens: 300000, will compress: false
✅ Total message tokens: 850000 < 1048576 (model limit)
✅ Request successful without overflow error
```

## 相关文件

- [message.ts](../../../../../../packages/skill-template/src/scheduler/utils/message.ts) - 消息构建
- [context.ts](../../../../../../packages/skill-template/src/scheduler/utils/context.ts) - 上下文准备和压缩
- [agent.ts](../../../../../../packages/skill-template/src/skills/agent.ts) - Agent skill 实现

## 总结

**根本原因**：上下文 token 预算管理不当，导致传递给 LLM 的内容超出模型限制。

**核心修复**：
1. ✅ 为 `prepareContext` 设置合理的 `maxTokens` 参数
2. ✅ 截断或压缩 `chatHistory`
3. ✅ 优化上下文选择策略

**验证方法**：
1. 添加 token 计数日志
2. 监控实际使用情况
3. 测试边界场景
