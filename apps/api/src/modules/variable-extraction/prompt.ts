import {
  WorkflowVariable,
  CanvasContext,
} from 'src/modules/variable-extraction/variable-extraction.dto';

/**
 * 基础提示词构建器 - 标准变量提取模式
 * 使用场景: 首次变量提取，无特殊要求的场景
 * 作用: 提供标准化的变量提取指导，平衡准确性和完整性
 */
export function buildVariableExtractionPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
): string {
  return buildEnhancedPrompt(userPrompt, existingVariables, canvasContext, 'standard');
}

/**
 * 增强提示词构建器 - 支持多种模式
 * 使用场景: 根据不同业务需求生成专门的提示词
 * 作用: 提供模式化的提示词，提升特定场景下的提取质量
 */
export function buildEnhancedPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
  mode: 'standard' | 'validation' | 'historical' | 'consensus' = 'standard',
): string {
  const existingVarsText = buildExistingVariablesText(existingVariables);
  const canvasContextText = buildCanvasContextText(canvasContext);

  let modeSpecificInstructions = '';

  switch (mode) {
    case 'validation':
      modeSpecificInstructions = buildValidationInstructions();
      break;
    case 'historical':
      modeSpecificInstructions = buildHistoricalInstructions();
      break;
    case 'consensus':
      modeSpecificInstructions = buildConsensusInstructions();
      break;
    default:
      modeSpecificInstructions = buildStandardInstructions();
  }

  return `# AI 工作流变量智能提取专家

你是一个专业的工作流分析专家，负责从用户的自然语言输入中智能提取可参数化的变量，构建高效的工作流模板。

## 核心任务
1. **精准识别**: 分析用户输入，识别所有可变参数
2. **智能分类**: 将参数归类为 string/resource/option 三种类型
3. **变量复用**: 检测并复用现有变量，避免重复创建
4. **模板生成**: 生成带占位符的 processedPrompt 模板

## 输入上下文

### 用户原始输入
\`\`\`
${userPrompt}
\`\`\`

### 现有变量库
${existingVarsText}

### 工作流上下文
${canvasContextText}

${modeSpecificInstructions}

## 变量类型定义

### 1. string (文本变量)
- **用途**: 纯文本内容、配置参数、描述信息
- **示例**: 主题、标题、要求、风格、语言等
- **命名**: topic, title, style, language, requirement

### 2. resource (资源变量) 
- **用途**: 需要用户上传的文件、文档、图片等
- **示例**: 简历文件、参考文档、图片素材等
- **命名**: resume_file, reference_doc, source_image

### 3. option (选项变量)
- **用途**: 预定义的选择项、枚举值
- **示例**: 格式选择、模式选择、级别选择等
- **命名**: output_format, processing_mode, difficulty_level

## 智能分析流程

### Step 1: 意图理解
- 分析用户的核心目标和期望输出
- 识别任务类型和复杂程度

### Step 2: 实体抽取
- 扫描用户输入中的具体值和概念
- 判断哪些内容可以参数化
- 区分固定内容和可变内容

### Step 3: 变量分类
- string: 用户可直接输入的文本内容
- resource: 需要上传的文件或外部资源
- option: 有限选择集合中的选项

### Step 4: 复用检测
- 语义相似度匹配 (阈值 0.8+)
- 指代词检测 ("这个"、"上述"、"刚才的")
- 上下文关联分析

### Step 5: 变量命名
- 使用英文 snake_case 格式
- 名称要见名知意且简洁
- 避免与现有变量名冲突

### Step 6: 模板构建
- 将提取的变量值替换为 {{variable_name}} 占位符
- 保持原文语义和结构完整
- 确保模板可读性和实用性

## 输出格式要求

**必须**返回标准 JSON 格式，不允许有任何格式错误：

\`\`\`json
{
  "analysis": {
    "userIntent": "用户意图的简洁描述",
    "extractionConfidence": 0.95,
    "complexityScore": 3,
    "extractedEntityCount": 5,
    "variableTypeDistribution": {
      "string": 3,
      "resource": 1, 
      "option": 1
    }
  },
  "variables": [
    {
      "name": "variable_name",
      "value": ["具体提取的值或空字符串"],
      "description": "变量用途描述",
      "variableType": "string",
      "source": "startNode",
      "extractionReason": "为什么提取这个变量",
      "confidence": 0.92
    }
  ],
  "reusedVariables": [
    {
      "detectedText": "原文中被复用的文本片段",
      "reusedVariableName": "复用的变量名",
      "confidence": 0.89,
      "reason": "复用的具体原因"
    }
  ],
  "processedPrompt": "替换变量后的模板字符串，使用{{variable_name}}格式",
  "originalPrompt": "原始用户输入"
}
\`\`\`

## 质量标准
- 变量名称：清晰、一致、见名知意
- 变量类型：准确分类，符合三种类型定义
- 复用检测：高准确率，减少冗余变量
- 处理后模板：保持原意，正确替换占位符`;
}

/**
 * 验证模式提示词 - 用于双路径验证
 * 使用场景: 增强直接模式下的验证LLM调用
 * 作用: 提供验证导向的提示词，重点关注变量准确性和合理性
 */
export function buildValidationPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
): string {
  return buildEnhancedPrompt(userPrompt, existingVariables, canvasContext, 'validation');
}

/**
 * 历史模式提示词 - 基于历史数据学习
 * 使用场景: 候选模式下的变量提取，有丰富历史数据
 * 作用: 利用历史成功模式和历史变量使用习惯，提供更精准的提取结果
 */
export function buildHistoricalPrompt(
  userPrompt: string,
  existingVariables: WorkflowVariable[],
  canvasContext: CanvasContext,
  historicalData: any,
): string {
  const basePrompt = buildEnhancedPrompt(
    userPrompt,
    existingVariables,
    canvasContext,
    'historical',
  );
  const historicalContext = buildHistoricalContext(historicalData);

  return `${basePrompt}

## 历史学习上下文
${historicalContext}

请基于历史成功模式和历史变量使用习惯，提供更精准的变量提取结果。`;
}

/**
 * 共识生成提示词 - 融合多个提取结果
 * 使用场景: 增强直接模式下的双路径结果融合
 * 作用: 对比和融合两个不同的变量提取结果，生成最优的共识方案
 */
export function buildConsensusPrompt(primaryResult: any, validationResult: any): string {
  return `# 变量提取结果共识生成专家

你是一个专业的变量提取结果分析专家，负责对比和融合两个不同的变量提取结果，生成最优的共识方案。

## 输入结果

### 主结果
\`\`\`json
${JSON.stringify(primaryResult.variables, null, 2)}
\`\`\`

### 验证结果
\`\`\`json
${JSON.stringify(validationResult.variables, null, 2)}
\`\`\`

## 共识生成要求

1. **质量优先**: 选择置信度更高、描述更清晰的变量定义
2. **智能合并**: 合并两个结果中的有效信息，避免重复
3. **一致性保证**: 确保最终结果在逻辑上一致
4. **复用优化**: 优先保留有效的变量复用建议

## 分析维度

- **变量完整性**: 检查是否覆盖了所有必要的参数
- **命名规范性**: 确保变量名称符合命名规范
- **类型准确性**: 验证变量类型分类是否合理
- **描述清晰度**: 评估变量描述的准确性和可理解性

## 输出格式

返回融合后的标准JSON格式：

\`\`\`json
{
  "variables": [
    {
      "name": "variable_name",
      "value": ["具体值"],
      "description": "变量用途描述",
      "variableType": "string",
      "source": "startNode"
    }
  ],
  "reusedVariables": [
    {
      "detectedText": "原文中被复用的文本片段",
      "reusedVariableName": "复用的变量名",
      "confidence": 0.89,
      "reason": "复用的具体原因"
    }
  ],
  "consensusReason": "为什么选择这个融合方案",
  "qualityScore": 0.95
}
\`\`\``;
}

/**
 * 构建现有变量文本 - 内部工具函数
 * 作用: 将现有变量格式化为可读的文本描述
 */
function buildExistingVariablesText(existingVariables: WorkflowVariable[]): string {
  if (existingVariables.length === 0) {
    return '- 暂无现有变量';
  }

  return existingVariables
    .map((v) => {
      const value = Array.isArray(v.value) ? v.value.join(', ') : v.value;
      return `- ${v.name} (${v.variableType}): ${v.description} [当前值: ${value || '空'}]`;
    })
    .join('\n');
}

/**
 * 构建画布上下文文本 - 内部工具函数
 * 作用: 将画布上下文信息格式化为结构化的文本描述
 */
function buildCanvasContextText(canvasContext: CanvasContext): string {
  const {
    nodeCount = 0,
    complexity = 0,
    resourceCount = 0,
    workflowType = '通用工作流',
    primarySkills = ['内容生成'],
    lastExtractionTime,
    recentVariablePatterns = [],
  } = canvasContext;

  let contextText = `- 画布节点: ${nodeCount} 个
- 工作流类型: ${workflowType}
- 主要技能: ${Array.isArray(primarySkills) ? primarySkills.join(', ') : primarySkills}
- 复杂度评分: ${complexity}/100
- 资源数量: ${resourceCount} 个`;

  if (lastExtractionTime) {
    contextText += `\n- 上次提取时间: ${new Date(lastExtractionTime).toLocaleString()}`;
  }

  if (recentVariablePatterns.length > 0) {
    contextText += `\n- 最近变量模式: ${recentVariablePatterns.slice(0, 5).join(', ')}`;
  }

  return contextText;
}

/**
 * 构建历史上下文 - 内部工具函数
 * 作用: 分析历史数据并生成结构化的历史学习上下文
 */
function buildHistoricalContext(historicalData: any): string {
  if (
    !historicalData ||
    !historicalData.extractionHistory ||
    historicalData.extractionHistory.length === 0
  ) {
    return '暂无历史提取记录，将使用标准提取策略';
  }

  const recentExtractions = historicalData.extractionHistory.slice(0, 5);
  const variableTypes = new Map<string, number>();
  const commonPatterns = new Set<string>();
  const successRates = new Map<string, number>();

  for (const record of recentExtractions) {
    try {
      const variables = JSON.parse(record.extractedVariables);
      for (const variable of variables) {
        // 统计变量类型分布
        const type = variable.variableType || 'unknown';
        variableTypes.set(type, (variableTypes.get(type) || 0) + 1);

        // 收集常见模式
        if (variable.description) {
          commonPatterns.add(variable.description);
        }
      }

      // 统计成功率
      const status = record.status || 'unknown';
      successRates.set(status, (successRates.get(status) || 0) + 1);
    } catch {
      // 忽略解析错误的记录
    }
  }

  // 构建历史上下文描述
  const typeDistribution = Array.from(variableTypes.entries())
    .map(([type, count]) => `${type}: ${count}个`)
    .join(', ');

  const patternList = Array.from(commonPatterns).slice(0, 3).join('、');

  const successRate = successRates.get('applied') || 0;
  const totalRecords = recentExtractions.length;
  const successPercentage = totalRecords > 0 ? Math.round((successRate / totalRecords) * 100) : 0;

  return `基于${historicalData.extractionHistory.length}次历史提取经验：
- 变量类型分布: ${typeDistribution}
- 常见模式: ${patternList || '无特定模式'}
- 最近提取时间: ${recentExtractions[0]?.createdAt?.toLocaleDateString() || '未知'}
- 历史成功率: ${successPercentage}% (${successRate}/${totalRecords})
- 最近提取记录: ${recentExtractions.length} 条`;
}

/**
 * 构建标准指令 - 内部工具函数
 * 作用: 为标准提取模式生成特定的指导说明
 */
function buildStandardInstructions(): string {
  return `## 标准提取模式
- 使用标准的质量评估标准
- 平衡准确性和完整性
- 优先考虑用户输入的明确性`;
}

/**
 * 构建验证指令 - 内部工具函数
 * 作用: 为验证提取模式生成特定的指导说明
 */
function buildValidationInstructions(): string {
  return `## 验证提取模式
- 重点关注变量的准确性和合理性
- 验证变量类型分类的正确性
- 检查变量命名的一致性
- 确保复用检测的准确性`;
}

/**
 * 构建历史指令 - 内部工具函数
 * 作用: 为历史学习模式生成特定的指导说明
 */
function buildHistoricalInstructions(): string {
  return `## 历史学习模式
- 基于历史成功模式进行提取
- 学习用户的变量使用偏好
- 优化变量命名和分类策略
- 提高复用检测的准确性`;
}

/**
 * 构建共识指令 - 内部工具函数
 * 作用: 为共识生成模式生成特定的指导说明
 */
function buildConsensusInstructions(): string {
  return `## 共识生成模式
- 对比多个提取结果的质量
- 选择最优的变量定义
- 合并有效的复用建议
- 确保结果的一致性和完整性`;
}
