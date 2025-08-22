import { WorkflowVariable } from '@refly/openapi-schema';
import { CanvasContentItem } from 'src/modules/canvas/canvas.dto';
// 重新导出 openapi-schema 中的 WorkflowVariable 类型
export { WorkflowVariable } from '@refly/openapi-schema';

// 核心返回类型
export interface VariableExtractionResult {
  originalPrompt: string; // 原始用户输入
  processedPrompt: string; // 处理后的prompt（包含变量引用）
  variables: WorkflowVariable[]; // 提取的变量列表
  reusedVariables: VariableReuse[]; // 复用的变量信息
  sessionId?: string; // 候选模式下的会话ID
}

// 变量复用信息
export interface VariableReuse {
  detectedText: string; // 原文本中检测到的表达
  reusedVariableName: string; // 复用的变量名
  confidence: number; // 置信度
  reason: string; // 复用原因
}

// APP模板生成结果
export interface AppTemplateResult {
  templateContent: string; // 包含占位符的模板
  variables: WorkflowVariable[]; // 相关变量列表
  metadata: {
    extractedAt: number; // 模板生成时间戳（用于版本控制）
    variableCount: number; // 变量总数（用于前端展示统计）
    promptCount?: number; // 原始prompt数量（用于质量评估）
    canvasComplexity?: string; // 画布复杂度（simple/medium/complex，影响模板展示）
    workflowType?: string; // 工作流类型（用于模板分类和展示）
    templateVersion?: number; // 模板版本号（支持模板迭代）
  };
}

// 上下文数据结构定义
export interface ExtractionContext {
  canvasData: CanvasData;
  variables: WorkflowVariable[];
  contentItems: CanvasContentItem[];
  analysis: CanvasAnalysis;
  extractionContext: ExtractionContextMetadata;
}

// 画布数据结构
export interface CanvasData {
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
  workflow?: WorkflowData;
}

// 画布节点
export interface CanvasNode {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
}

// 画布边
export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
}

// 工作流数据
export interface WorkflowData {
  variables?: WorkflowVariable[];
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
}

// 使用Canvas服务的CanvasContentItem类型
export { CanvasContentItem } from '../canvas/canvas.dto';

// 画布分析结果
export interface CanvasAnalysis {
  complexity: number; // 复杂度评分 0-100
  nodeCount: number; // 节点数量
  variableCount: number; // 变量数量
  resourceCount: number; // 资源数量
  workflowType?: string; // 工作流类型
  primarySkills?: string[]; // 主要技能
}

// 画布上下文信息 - 用于提示词构建
export interface CanvasContext {
  nodeCount: number; // 画布节点数量
  complexity: number; // 复杂度评分 0-100
  resourceCount: number; // 资源数量
  workflowType?: string; // 工作流类型
  primarySkills?: string[]; // 主要技能
  lastExtractionTime?: Date; // 上次提取时间
  recentVariablePatterns?: string[]; // 最近的变量模式
}

// 提取上下文元数据
export interface ExtractionContextMetadata {
  lastExtractionTime?: Date; // 上次提取时间
  recentVariablePatterns: string[]; // 最近的变量模式
}

// 用户工作流偏好
export interface UserWorkflowPreferences {
  preferredVariableTypes?: string[];
  commonWorkflowPatterns?: string[];
  extractionHistory?: ExtractionHistoryItem[];
}

// 提取历史项
export interface ExtractionHistoryItem {
  timestamp: Date;
  prompt: string;
  extractedVariables: string[];
  confidence: number;
}

// 候选记录类型
export interface CandidateRecord {
  sessionId: string;
  canvasId: string;
  uid: string;
  originalPrompt: string;
  extractedVariables: WorkflowVariable[];
  reusedVariables: VariableReuse[];
  applied: boolean;
  expiresAt: Date;
  createdAt: Date;
}

// LLM提取响应类型
export interface LLMExtractionResponse {
  variables: ExtractedVariable[];
  processedPrompt: string;
  confidence: number;
  reasoning?: string;
}

// 提取的变量
export interface ExtractedVariable {
  name: string;
  value: string;
  description?: string;
  variableType: 'string' | 'option' | 'resource';
  confidence: number;
  source: 'llm_extraction' | 'variable_reuse' | 'context_analysis';
}

// 质量评估结果
export interface QualityMetrics {
  overallScore: number; // 总体评分 0-100
  variableCompleteness: number; // 变量完整性
  promptClarity: number; // 提示清晰度
  contextRelevance: number; // 上下文相关性
  suggestions: string[]; // 改进建议
}

// 历史数据接口
export interface HistoricalData {
  extractionHistory: ExtractionHistoryRecord[];
  canvasPatterns: string[];
}

// 提取历史记录
export interface ExtractionHistoryRecord {
  extractedVariables: string;
  status: string;
  createdAt: Date;
}

// 内容项类型
export interface CanvasContentItemWithType {
  id: string;
  type: string;
  title: string;
  content?: string;
}
