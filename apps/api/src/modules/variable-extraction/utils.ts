import { COMPLEXITY_WEIGHTS, CONFIDENCE_WEIGHTS, DEFAULT_VALUES } from './constants';
import type { CanvasNode, CanvasEdge, WorkflowVariable } from './variable-extraction.dto';

/**
 * 计算画布复杂度评分
 * @param nodes 画布节点
 * @param edges 画布边
 * @param variables 工作流变量
 * @returns 复杂度评分 0-100
 */
export function calculateCanvasComplexity(
  nodes: CanvasNode[] = [],
  edges: CanvasEdge[] = [],
  variables: WorkflowVariable[] = [],
): number {
  if (!nodes?.length && !edges?.length && !variables?.length) {
    return 0;
  }

  let score = 0;

  // 节点数量评分
  score += Math.min(nodes.length * COMPLEXITY_WEIGHTS.NODE_COUNT, 30);

  // 边数量评分
  score += Math.min(edges.length * COMPLEXITY_WEIGHTS.EDGE_COUNT, 20);

  // 变量数量评分
  score += Math.min(variables.length * COMPLEXITY_WEIGHTS.VARIABLE_COUNT, 20);

  // 节点类型多样性评分
  const nodeTypes = new Set(nodes.map((node) => node.type));
  score += Math.min(nodeTypes.size * COMPLEXITY_WEIGHTS.NODE_TYPE_DIVERSITY, 30);

  return Math.min(score, COMPLEXITY_WEIGHTS.MAX_SCORE);
}

/**
 * 检测工作流类型
 * @param contentItems 内容项
 * @param variables 变量
 * @returns 工作流类型
 */
export function detectWorkflowType(
  contentItems: Array<{ type: string; title?: string }> = [],
  variables: WorkflowVariable[] = [],
): string {
  if (!contentItems?.length && !variables?.length) {
    return DEFAULT_VALUES.WORKFLOW_TYPE;
  }

  // 基于内容项类型判断
  const typeCounts = contentItems.reduce(
    (acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // 基于变量名称判断
  const variableNames = variables.map((v) => v.name.toLowerCase()).join(' ');

  if (
    typeCounts.startNode > 0 ||
    variableNames.includes('project') ||
    variableNames.includes('task')
  ) {
    return '项目管理';
  }

  if (
    typeCounts.codeNode > 0 ||
    variableNames.includes('code') ||
    variableNames.includes('function')
  ) {
    return '代码开发';
  }

  if (
    typeCounts.dataNode > 0 ||
    variableNames.includes('data') ||
    variableNames.includes('analysis')
  ) {
    return '数据分析';
  }

  if (
    typeCounts.designNode > 0 ||
    variableNames.includes('design') ||
    variableNames.includes('ui')
  ) {
    return '设计创作';
  }

  return DEFAULT_VALUES.WORKFLOW_TYPE;
}

/**
 * 识别主要技能
 * @param contentItems 内容项
 * @param variables 变量
 * @returns 主要技能列表
 */
export function identifyPrimarySkills(
  contentItems: Array<{ type: string; title?: string }> = [],
  variables: WorkflowVariable[] = [],
): string[] {
  if (!contentItems?.length && !variables?.length) {
    return [...DEFAULT_VALUES.PRIMARY_SKILLS];
  }

  const skills = new Set<string>();

  // 基于内容项类型识别技能
  for (const item of contentItems) {
    switch (item.type) {
      case 'startNode':
        skills.add('需求分析');
        break;
      case 'codeNode':
        skills.add('代码开发');
        break;
      case 'dataNode':
        skills.add('数据处理');
        break;
      case 'designNode':
        skills.add('设计创作');
        break;
      case 'apiNode':
        skills.add('API集成');
        break;
      case 'workflowNode':
        skills.add('工作流编排');
        break;
    }
  }

  // 基于变量名称识别技能
  const variableNames = variables.map((v) => v.name.toLowerCase()).join(' ');

  if (variableNames.includes('prompt') || variableNames.includes('template')) {
    skills.add('提示词工程');
  }

  if (variableNames.includes('api') || variableNames.includes('endpoint')) {
    skills.add('API设计');
  }

  if (variableNames.includes('database') || variableNames.includes('query')) {
    skills.add('数据库操作');
  }

  return skills.size > 0 ? Array.from(skills) : [...DEFAULT_VALUES.PRIMARY_SKILLS];
}

/**
 * 计算置信度分数
 * @param variables 变量数量
 * @param hasProcessedPrompt 是否有处理后的提示词
 * @param reusedVariables 复用变量数量
 * @returns 置信度分数 0-1
 */
export function calculateConfidence(
  variables: number,
  hasProcessedPrompt: boolean,
  reusedVariables: number,
): number {
  let confidence = CONFIDENCE_WEIGHTS.BASE_CONFIDENCE;

  // 变量数量加成
  confidence += Math.min(variables * CONFIDENCE_WEIGHTS.PER_VARIABLE_BONUS, 0.3);

  // 处理后提示词加成
  if (hasProcessedPrompt) {
    confidence += CONFIDENCE_WEIGHTS.PROCESSED_PROMPT_BONUS;
  }

  // 复用变量加成
  confidence += Math.min(reusedVariables * CONFIDENCE_WEIGHTS.REUSE_BONUS, 0.1);

  return Math.min(confidence, CONFIDENCE_WEIGHTS.MAX_CONFIDENCE);
}

/**
 * 生成会话ID
 * @param prefix 前缀
 * @param timestamp 时间戳
 * @returns 会话ID
 */
export function generateSessionId(prefix: string, timestamp: number): string {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${randomSuffix}`;
}

/**
 * 检查候选记录是否过期
 * @param expiresAt 过期时间
 * @returns 是否过期
 */
export function isCandidateRecordExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * 计算候选记录过期时间
 * @param hours 小时数
 * @returns 过期时间
 */
export function calculateExpiryTime(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * 验证变量提取结果
 * @param result 提取结果
 * @returns 是否有效
 */
export function validateExtractionResult(result: {
  variables: unknown[];
  processedPrompt?: string;
}): boolean {
  return (
    Array.isArray(result.variables) &&
    result.variables.length > 0 &&
    typeof result.processedPrompt === 'string' &&
    result.processedPrompt.length > 0
  );
}

/**
 * 清理和标准化变量名称
 * @param name 原始名称
 * @returns 标准化名称
 */
export function normalizeVariableName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * 检查变量名称是否有效
 * @param name 变量名称
 * @returns 是否有效
 */
export function isValidVariableName(name: string): boolean {
  const normalized = normalizeVariableName(name);
  return normalized.length > 0 && normalized.length <= 50;
}

/**
 * 生成变量描述
 * @param name 变量名称
 * @param context 上下文信息
 * @returns 变量描述
 */
export function generateVariableDescription(
  name: string,
  context: Record<string, unknown> = {},
): string {
  const normalizedName = name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  if (context.workflowType) {
    return `${normalizedName} for ${context.workflowType}`;
  }

  return normalizedName;
}

/**
 * 为新变量添加时间戳字段
 * @param variable 变量对象
 * @returns 带时间戳的变量对象
 */
export function addTimestampsToNewVariable(variable: WorkflowVariable): WorkflowVariable {
  const now = new Date().toISOString();
  return {
    ...variable,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 为更新的变量添加更新时间戳
 * @param variable 变量对象
 * @param existingVariable 现有变量对象
 * @returns 更新时间戳的变量对象
 */
export function updateTimestampForVariable(
  variable: WorkflowVariable,
  existingVariable?: WorkflowVariable,
): WorkflowVariable {
  const now = new Date().toISOString();
  return {
    ...variable,
    createdAt: existingVariable?.createdAt || now, // 保持原有创建时间或使用当前时间
    updatedAt: now, // 总是更新修改时间
  };
}

/**
 * 检查变量是否发生了实质性变化
 * @param newVariable 新变量
 * @param existingVariable 现有变量
 * @returns 是否有变化
 */
export function hasVariableChanged(
  newVariable: WorkflowVariable,
  existingVariable: WorkflowVariable,
): boolean {
  // 比较核心字段，忽略时间戳字段
  const coreFields: (keyof WorkflowVariable)[] = [
    'name',
    'value',
    'description',
    'variableType',
    'source',
    'options',
  ];

  for (const field of coreFields) {
    const newValue = newVariable[field];
    const existingValue = existingVariable[field];

    // 对数组类型进行深度比较
    if (Array.isArray(newValue) && Array.isArray(existingValue)) {
      if (newValue.length !== existingValue.length) {
        return true;
      }
      for (let i = 0; i < newValue.length; i++) {
        if (newValue[i] !== existingValue[i]) {
          return true;
        }
      }
    } else if (newValue !== existingValue) {
      return true;
    }
  }

  return false;
}
