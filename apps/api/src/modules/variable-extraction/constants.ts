/**
 * Variable Extraction 模块配置常量
 */

// 质量评估阈值
export const QUALITY_THRESHOLDS = {
  ENHANCED_DIRECT_MODE: 0.8, // 增强直接模式质量阈值
  VARIABLE_COMPLETENESS: 0.8, // 变量完整性阈值
  MIN_VARIABLE_QUALITY: 0.5, // 最小变量质量分数
} as const;

// 时间配置
export const TIME_CONFIG = {
  CANDIDATE_RECORD_EXPIRY_HOURS: 1, // 候选记录过期时间（小时）
  CANDIDATE_RECORD_EXPIRY_MS: 3600000, // 候选记录过期时间（毫秒）
} as const;

// 复杂度评分权重
export const COMPLEXITY_WEIGHTS = {
  NODE_COUNT: 3, // 节点数量权重
  EDGE_COUNT: 2, // 边数量权重
  VARIABLE_COUNT: 2, // 变量数量权重
  NODE_TYPE_DIVERSITY: 5, // 节点类型多样性权重
  MAX_SCORE: 100, // 最大复杂度分数
} as const;

// 置信度计算权重
export const CONFIDENCE_WEIGHTS = {
  BASE_CONFIDENCE: 0.5, // 基础置信度
  PER_VARIABLE_BONUS: 0.1, // 每个变量的置信度加成
  PROCESSED_PROMPT_BONUS: 0.1, // 处理后提示词的置信度加成
  REUSE_BONUS: 0.05, // 复用变量的置信度加成
  MAX_CONFIDENCE: 0.9, // 最大置信度
} as const;

// 数据库查询限制
export const DATABASE_LIMITS = {
  RECENT_RECORDS: 10, // 最近记录数量
  COMPREHENSIVE_HISTORY: 20, // 完整历史记录数量
  VARIABLE_PATTERNS: 10, // 变量模式数量
} as const;

// 默认值
export const DEFAULT_VALUES = {
  WORKFLOW_TYPE: '通用工作流',
  PRIMARY_SKILLS: ['内容生成'],
  VARIABLE_PATTERNS: ['项目名称', '目标用户', '功能范围', '时间要求', '质量标准'],
} as const;

// 错误消息
export const ERROR_MESSAGES = {
  NO_LLM_PROVIDER: 'No valid LLM provider found for variable extraction',
  NO_LLM_PROVIDER_VALIDATION: 'No valid LLM provider found for validation',
  NO_LLM_PROVIDER_MULTI_ROUND: 'No valid LLM provider found for multi-round extraction',
  NO_JSON_IN_RESPONSE: 'No JSON found in LLM response',
  INVALID_RESPONSE_STRUCTURE: 'Invalid response structure: missing variables array',
  FAILED_TO_APPLY_CANDIDATE: 'Failed to apply candidate record',
  FAILED_TO_UPDATE_CANVAS: 'Failed to update canvas variables',
  FAILED_TO_SAVE_CANDIDATE: 'Failed to save candidate record',
} as const;

// 会话ID前缀
export const SESSION_PREFIXES = {
  CANDIDATE: 'candidate',
} as const;

// 触发类型
export const TRIGGER_TYPES = {
  ASK_AI_DIRECT: 'askAI_direct',
  ASK_AI_CANDIDATE: 'askAI_candidate',
} as const;

// 提取模式
export const EXTRACTION_MODES = {
  DIRECT: 'direct',
  CANDIDATE: 'candidate',
} as const;

// 状态值
export const STATUS_VALUES = {
  PENDING: 'pending',
  APPLIED: 'applied',
} as const;
