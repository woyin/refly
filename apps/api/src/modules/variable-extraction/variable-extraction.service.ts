import { Injectable, Logger } from '@nestjs/common';
import { User } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas/canvas-sync.service';
import { ProviderService } from '../provider/provider.service';
import { buildVariableExtractionPrompt } from './prompt';
import {
  ExtractionContext,
  VariableExtractionResult,
  VariableReuse,
  WorkflowVariable,
  CandidateRecord,
  QualityMetrics,
  CanvasData,
  CanvasContentItem,
  UserWorkflowPreferences,
} from 'src/modules/variable-extraction/variable-extraction.dto';

@Injectable()
export class VariableExtractionService {
  private logger = new Logger(VariableExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly canvasService: CanvasService,
    private readonly canvasSyncService: CanvasSyncService,
    private readonly providerService: ProviderService,
  ) {}
  /**
   * 核心变量提取方法（集成上下文分析）
   */
  async extractVariables(
    user: User,
    prompt: string,
    canvasId: string,
    mode: 'direct' | 'candidate' = 'direct',
    sessionId?: string,
  ): Promise<VariableExtractionResult> {
    // 1. 检查候选记录（直接模式且有sessionId时）
    if (mode === 'direct' && sessionId) {
      const candidateRecord = await this.getCandidateRecord(sessionId);
      if (candidateRecord && !candidateRecord.applied) {
        return this.applyCandidateRecord(user, canvasId, candidateRecord);
      }
    }

    // 2. 构建上下文（多维度分析）
    const context = await this.buildEnhancedContext(canvasId, user);

    // 3. 基于上下文进行智能提取
    const extractionResult = await this.performLLMExtraction(prompt, context, user);

    // 4. 智能变量复用检测
    await this.detectAdvancedVariableReuse(prompt, context.variables, context);

    // 5. 结果质量评估和优化
    await this.validateExtractionQuality(extractionResult, context);

    // 6. 根据模式处理结果
    if (mode === 'direct') {
      await this.updateCanvasVariables(user, canvasId, extractionResult.variables);
      await this.saveExtractionHistory(user, canvasId, extractionResult, 'direct');
    } else {
      const sessionId = await this.saveCandidateRecord(user, canvasId, extractionResult);
      extractionResult.sessionId = sessionId;
    }

    return extractionResult;
  }

  /**
   * 构建上下文 - 多维度Canvas分析
   */
  private async buildEnhancedContext(canvasId: string, user: User): Promise<ExtractionContext> {
    try {
      // 1. 获取Canvas数据和内容项
      const contentItems = await this.canvasService.getCanvasContentItems(user, canvasId, true);

      // 2. 获取Canvas工作流信息（包含现有变量）
      const canvasData = await this.getCanvasWorkflowData(user, canvasId);

      // 3. 提取现有工作流变量
      const variables = await this.getCanvasVariables(user, canvasId);

      // 4. 智能分析Canvas特征
      const analysis = {
        // 计算工作流复杂度（节点数、连接数、嵌套层级）
        complexity: this.calculateComplexityScore(canvasData),

        // 检测工作流类型（内容处理、数据分析、文档生成等）
        workflowType: this.detectWorkflowPattern(canvasData, contentItems),

        // 提取主要技能类型（影响变量提取策略）
        primarySkills: this.extractPrimarySkills(canvasData),

        // 基础统计信息
        nodeCount: canvasData.nodes?.length || 0,
        variableCount: variables.length,
        resourceCount: contentItems.filter((item) => item.type === 'resource').length,
      };

      this.logger.log(
        `Built context for canvas ${canvasId}: ${analysis.nodeCount} nodes, ${analysis.variableCount} variables, workflow type: ${analysis.workflowType}`,
      );

      return {
        canvasData,
        variables,
        contentItems,
        analysis,
        // 上下文元数据
        extractionContext: {
          lastExtractionTime: await this.getLastExtractionTime(canvasId),
          recentVariablePatterns: await this.getRecentVariablePatterns(canvasId),
          userWorkflowPreferences: await this.getUserWorkflowPreferences(user.uid),
        },
      };
    } catch (error) {
      this.logger.error(`Error building context for canvas ${canvasId}:`, error);
      // 返回空的上下文以保证服务可用性
      return {
        canvasData: { nodes: [] },
        variables: [],
        contentItems: [],
        analysis: {
          complexity: 0,
          workflowType: '通用工作流',
          primarySkills: ['内容生成'],
          nodeCount: 0,
          variableCount: 0,
          resourceCount: 0,
        },
        extractionContext: {
          lastExtractionTime: undefined,
          recentVariablePatterns: [],
          userWorkflowPreferences: await this.getUserWorkflowPreferences(user.uid),
        },
      };
    }
  }

  /**
   * 智能变量复用检测 - 多层匹配策略
   */
  private async detectAdvancedVariableReuse(
    prompt: string,
    existingVariables: WorkflowVariable[],
    _context: ExtractionContext,
  ): Promise<VariableReuse[]> {
    const reuses: VariableReuse[] = [];

    for (const variable of existingVariables) {
      // 1. 语义相似度匹配（基于文本embedding）
      const semanticScore = await this.calculateSemanticSimilarity(
        prompt,
        variable.description || variable.name,
      );

      // 2. 上下文关联性分析
      const contextualScore = this.analyzeContextualRelevance(
        variable,
        _context.analysis.workflowType,
        _context.analysis.primarySkills,
      );

      // 3. 指代词检测（"这个"、"刚才的"、"上面的"）
      const referenceScore = this.detectReferencePatterns(prompt, variable);

      // 4. 综合评分
      const totalScore = semanticScore * 0.5 + contextualScore * 0.3 + referenceScore * 0.2;

      if (totalScore > 0.75) {
        reuses.push({
          detectedText: this.extractReferencedText(prompt, variable),
          reusedVariableName: variable.name,
          confidence: totalScore,
          reason: this.generateReuseReason(semanticScore, contextualScore, referenceScore),
        });
      }
    }

    return reuses;
  }

  // TODO: Implement missing methods
  private async getCandidateRecord(sessionId: string): Promise<CandidateRecord | null> {
    try {
      const record = await this.prisma.variableExtractionHistory.findUnique({
        where: {
          sessionId,
          status: 'pending',
          extractionMode: 'candidate',
          expiresAt: {
            gt: new Date(), // 未过期
          },
        },
      });

      if (!record) {
        return null;
      }

      // 转换数据库记录为CandidateRecord格式
      return {
        sessionId: record.sessionId!,
        canvasId: record.canvasId,
        uid: record.uid,
        originalPrompt: record.originalPrompt,
        extractedVariables: JSON.parse(record.extractedVariables),
        reusedVariables: JSON.parse(record.reusedVariables),
        applied: record.status === 'applied',
        expiresAt: record.expiresAt!,
        createdAt: record.createdAt,
      };
    } catch (error) {
      this.logger.error(`Error getting candidate record ${sessionId}:`, error);
      return null;
    }
  }

  private async applyCandidateRecord(
    user: User,
    canvasId: string,
    record: CandidateRecord,
  ): Promise<VariableExtractionResult> {
    try {
      this.logger.log(`Applying candidate record ${record.sessionId} for canvas ${canvasId}`);

      // 将候选记录转换为提取结果
      const result: VariableExtractionResult = {
        originalPrompt: record.originalPrompt,
        processedPrompt: this.generateProcessedPrompt(
          record.originalPrompt,
          record.extractedVariables,
        ),
        variables: record.extractedVariables,
        reusedVariables: record.reusedVariables,
        sessionId: record.sessionId,
      };

      // 更新候选记录状态为已应用
      await this.prisma.variableExtractionHistory.update({
        where: {
          sessionId: record.sessionId,
          uid: user.uid,
        },
        data: {
          status: 'applied',
          appliedAt: new Date(),
        },
      });

      // 更新Canvas变量
      await this.updateCanvasVariables(user, canvasId, record.extractedVariables);

      // 记录为直接模式的历史记录
      await this.saveExtractionHistory(user, canvasId, result, 'direct');

      this.logger.log(`Successfully applied candidate record ${record.sessionId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error applying candidate record ${record.sessionId}:`, error);
      throw new Error(`Failed to apply candidate record: ${error.message}`);
    }
  }

  /**
   * 根据提取的变量生成处理后的prompt模板
   */
  private generateProcessedPrompt(originalPrompt: string, variables: WorkflowVariable[]): string {
    let processedPrompt = originalPrompt;

    // 将变量替换为占位符格式
    for (const variable of variables) {
      const placeholder = `{{${variable.name}}}`;
      // 处理 value 为数组的情况，取第一个值用于替换
      const valueToReplace = Array.isArray(variable.value) ? variable.value[0] : variable.value;
      if (valueToReplace) {
        // 简单的文本替换，实际实现时可能需要更智能的匹配
        processedPrompt = processedPrompt.replace(new RegExp(valueToReplace, 'gi'), placeholder);
      }
    }

    return processedPrompt;
  }

  private async performLLMExtraction(
    prompt: string,
    context: ExtractionContext,
    user: User,
  ): Promise<VariableExtractionResult> {
    try {
      // 1. 获取LLM模型实例（参考pilot.service.ts的模式）
      const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
      if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
        throw new Error('No valid LLM provider found for variable extraction');
      }

      const model = await this.providerService.prepareChatModel(user, chatPi.itemId);

      // 2. 构建变量提取提示词
      const extractionPrompt = buildVariableExtractionPrompt(prompt, context.variables, {
        nodeCount: context.analysis.nodeCount,
        primarySkills: context.analysis.primarySkills,
        workflowType: context.analysis.workflowType,
        complexity: context.analysis.complexity,
        resourceCount: context.analysis.resourceCount,
      });

      this.logger.log(`Performing LLM extraction for prompt: "${prompt.substring(0, 100)}..."`);

      // 3. 调用LLM进行变量提取
      const response = await model.invoke(extractionPrompt);
      const responseText = response.content.toString();

      // 4. 解析LLM响应
      const extractionResult = this.parseLLMResponse(responseText, prompt);

      this.logger.log(
        `LLM extraction completed with ${extractionResult.variables.length} variables`,
      );

      return extractionResult;
    } catch (error) {
      this.logger.error(`Error in LLM extraction: ${error.message}`);

      // 降级到基础模式，确保服务可用性
      return this.performBasicExtraction(prompt, context);
    }
  }

  /**
   * 解析LLM响应获取变量提取结果
   */
  private parseLLMResponse(responseText: string, originalPrompt: string): VariableExtractionResult {
    try {
      this.logger.log('Parsing LLM response for variable extraction');

      // 尝试从响应中提取JSON，支持多种格式
      const jsonMatch =
        responseText.match(/```json\s*\n([\s\S]*?)\n\s*```/) ||
        responseText.match(/```\s*\n([\s\S]*?)\n\s*```/) ||
        responseText.match(/\{[\s\S]*\}/) ||
        responseText.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        this.logger.warn('No JSON structure found in LLM response');
        throw new Error('No JSON found in LLM response');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      this.logger.debug(`Parsing JSON: ${jsonText.substring(0, 200)}...`);

      const parsed = JSON.parse(jsonText);

      // 验证响应结构 - 支持新的分析字段
      if (!parsed.variables || !Array.isArray(parsed.variables)) {
        this.logger.warn('Invalid response structure: missing or invalid variables array');
        throw new Error('Invalid response structure: missing variables array');
      }

      // 验证分析字段
      if (!parsed.analysis) {
        this.logger.warn('Missing analysis field in LLM response');
      }

      // 转换为标准格式，确保所有必需字段存在
      const variables: WorkflowVariable[] = parsed.variables.map((v: any, index: number) => {
        // 确保变量值是数组格式
        let value: string[];
        if (Array.isArray(v.value)) {
          value = v.value;
        } else if (typeof v.value === 'string') {
          value = [v.value];
        } else {
          value = [''];
        }

        return {
          name: v.name || `extracted_var_${index + 1}`,
          value,
          description: v.description || `提取的变量 ${index + 1}`,
          variableType: v.variableType || 'string',
          source: v.source || 'startNode',
        };
      });

      // 获取处理后的提示词
      const processedPrompt =
        parsed.processedPrompt || this.generateProcessedPrompt(originalPrompt, variables);

      // 处理复用变量
      const reusedVariables = (parsed.reusedVariables || []).map((rv: any) => ({
        detectedText: rv.detectedText || '',
        reusedVariableName: rv.reusedVariableName || '',
        confidence: rv.confidence || 0.5,
        reason: rv.reason || '系统检测到的复用机会',
      }));

      // 记录提取统计信息
      const analysis = parsed.analysis || {};
      this.logger.log(
        `LLM extraction completed: ${variables.length} variables, ` +
          `confidence: ${analysis.extractionConfidence || 'unknown'}, ` +
          `complexity: ${analysis.complexityScore || 'unknown'}`,
      );

      return {
        originalPrompt,
        processedPrompt,
        variables,
        reusedVariables,
      };
    } catch (error) {
      this.logger.error(`Failed to parse LLM response: ${error.message}`);
      this.logger.debug(`Raw response: ${responseText.substring(0, 500)}...`);

      // 返回基础结果，确保服务可用性
      return {
        originalPrompt,
        processedPrompt: originalPrompt,
        variables: [],
        reusedVariables: [],
      };
    }
  }

  /**
   * 基础变量提取（降级模式）
   */
  private performBasicExtraction(
    prompt: string,
    context: ExtractionContext,
  ): VariableExtractionResult {
    this.logger.log('Performing basic extraction as fallback');

    // 简单的关键词匹配提取
    const variables: WorkflowVariable[] = [];

    // 基于工作流类型预设一些通用变量
    if (context.analysis.workflowType.includes('文档')) {
      variables.push({
        name: 'document_title',
        value: [''],
        description: '文档标题',
        variableType: 'string',
        source: 'startNode',
      });
    }

    if (context.analysis.workflowType.includes('项目')) {
      variables.push({
        name: 'project_name',
        value: [''],
        description: '项目名称',
        variableType: 'string',
        source: 'startNode',
      });
    }

    return {
      originalPrompt: prompt,
      processedPrompt: prompt,
      variables,
      reusedVariables: [],
    };
  }

  private async validateExtractionQuality(
    result: VariableExtractionResult,
    context: ExtractionContext,
  ): Promise<QualityMetrics> {
    // TODO: 实际实现时进行更复杂的质量评估
    // Mock 质量评估逻辑

    // 计算变量完整性评分
    const variableCompleteness = Math.min(100, result.variables.length * 20);

    // 计算提示清晰度评分（基于原始prompt长度和变量数量）
    const promptClarity = Math.min(
      100,
      Math.max(0, 100 - result.variables.length * 10 + result.originalPrompt.length / 2),
    );

    // 计算上下文相关性评分
    const contextRelevance = context.variables.length > 0 ? 85 : 70;

    // 总体评分
    const overallScore = Math.round((variableCompleteness + promptClarity + contextRelevance) / 3);

    // 生成改进建议
    const suggestions: string[] = [];
    if (result.variables.length < 2) {
      suggestions.push('建议提供更多具体的变量信息');
    }
    if (result.originalPrompt.length < 20) {
      suggestions.push('提示信息可以更详细一些');
    }
    if (context.variables.length === 0) {
      suggestions.push('可以考虑复用画布中已有的变量');
    }

    const qualityMetrics: QualityMetrics = {
      overallScore,
      variableCompleteness,
      promptClarity,
      contextRelevance,
      suggestions,
    };

    return qualityMetrics;
  }

  private async updateCanvasVariables(
    user: User,
    canvasId: string,
    variables: WorkflowVariable[],
  ): Promise<void> {
    try {
      this.logger.log(
        `Updating canvas ${canvasId} with ${variables.length} variables for user ${user.uid}`,
      );

      // Get current canvas state to retrieve workflow variables
      const currentVariables = await this.canvasSyncService.getWorkflowVariables(user, {
        canvasId,
      });

      // Merge new variables with existing ones, avoiding duplicates
      const mergedVariables = [...(currentVariables || [])];

      for (const newVariable of variables) {
        const existingIndex = mergedVariables.findIndex((v) => v.name === newVariable.name);
        if (existingIndex >= 0) {
          // Update existing variable
          mergedVariables[existingIndex] = newVariable;
        } else {
          // Add new variable
          mergedVariables.push(newVariable);
        }
      }

      // Use CanvasSyncService to update workflow variables in canvas
      await this.canvasSyncService.updateWorkflowVariables(user, {
        canvasId,
        variables: mergedVariables,
      });

      this.logger.log(`Canvas variables updated successfully for canvas ${canvasId}`);
    } catch (error) {
      this.logger.error(`Failed to update canvas variables for ${canvasId}: ${error.message}`);
      throw new Error(`Failed to update canvas variables: ${error.message}`);
    }
  }

  private async saveExtractionHistory(
    user: User,
    canvasId: string,
    result: VariableExtractionResult,
    mode: string,
    processingTimeMs?: number,
    model?: string,
  ): Promise<void> {
    try {
      await this.prisma.variableExtractionHistory.create({
        data: {
          sessionId: result.sessionId || null,
          canvasId,
          uid: user.uid,
          triggerType: 'askAI_direct', // 可以后续通过参数传入
          extractionMode: mode,
          originalPrompt: result.originalPrompt,
          processedPrompt: result.processedPrompt,
          extractedVariables: JSON.stringify(result.variables),
          reusedVariables: JSON.stringify(result.reusedVariables),
          extractionConfidence: this.calculateOverallConfidence(result),
          processingTimeMs: processingTimeMs || null,
          llmModel: model || null,
          status: 'applied',
          appliedAt: new Date(),
        },
      });

      this.logger.log(`Saved extraction history for canvas ${canvasId}, mode: ${mode}`);
    } catch (error) {
      this.logger.error(`Error saving extraction history for canvas ${canvasId}:`, error);
      // 不抛出错误，保证主流程继续
    }
  }

  private async saveCandidateRecord(
    user: User,
    canvasId: string,
    result: VariableExtractionResult,
    processingTimeMs?: number,
    model?: string,
  ): Promise<string> {
    try {
      const sessionId = `candidate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 3600000); // 1小时后过期

      await this.prisma.variableExtractionHistory.create({
        data: {
          sessionId,
          canvasId,
          uid: user.uid,
          triggerType: 'askAI_candidate',
          extractionMode: 'candidate',
          originalPrompt: result.originalPrompt,
          processedPrompt: result.processedPrompt,
          extractedVariables: JSON.stringify(result.variables),
          reusedVariables: JSON.stringify(result.reusedVariables),
          extractionConfidence: this.calculateOverallConfidence(result),
          processingTimeMs: processingTimeMs || null,
          llmModel: model || null,
          status: 'pending',
          expiresAt,
        },
      });

      this.logger.log(
        `Saved candidate record ${sessionId} for canvas ${canvasId}, expires at ${expiresAt}`,
      );
      return sessionId;
    } catch (error) {
      this.logger.error(`Error saving candidate record for canvas ${canvasId}:`, error);
      throw new Error('Failed to save candidate record');
    }
  }

  private calculateComplexityScore(canvasData: CanvasData): number {
    // TODO: Mocked for now. Implement more complex calculation based on actual canvas structure.

    let score = 0;

    // 基于节点数量计算基础分数
    const nodeCount = canvasData.nodes?.length || 0;
    if (nodeCount > 0) {
      score += Math.min(30, nodeCount * 3);
    }

    // 基于边数量计算连接复杂度
    const edgeCount = canvasData.edges?.length || 0;
    if (edgeCount > 0) {
      score += Math.min(25, edgeCount * 2);
    }

    // 基于工作流变量数量计算
    const variableCount = canvasData.workflow?.variables?.length || 0;
    if (variableCount > 0) {
      score += Math.min(20, variableCount * 2);
    }

    // 基于节点类型多样性计算
    const nodeTypes = new Set(canvasData.nodes?.map((n) => n.type) || []);
    score += Math.min(25, nodeTypes.size * 5);

    return Math.min(100, score);
  }

  private detectWorkflowPattern(canvasData: CanvasData, contentItems: CanvasContentItem[]): string {
    // TODO: Mocked for now. Implement more intelligent workflow pattern recognition.

    const nodeTypes = canvasData.nodes?.map((n) => n.type) || [];
    const resourceCount = contentItems.filter((item) => item.type === 'resource').length;
    const skillCount = contentItems.filter((item) => item.type === 'skillResponse').length;

    // 基于节点类型和内容项判断工作流类型
    if (nodeTypes.includes('document') || nodeTypes.includes('text')) {
      return '文档生成';
    }

    if (nodeTypes.includes('image') || nodeTypes.includes('media')) {
      return '媒体处理';
    }

    if (resourceCount > 2) {
      return '内容分析';
    }

    if (skillCount > 1) {
      return '技能编排';
    }

    if (nodeTypes.includes('api') || nodeTypes.includes('http')) {
      return 'API集成';
    }

    if (nodeTypes.includes('database') || nodeTypes.includes('query')) {
      return '数据处理';
    }

    return '通用工作流';
  }

  private extractPrimarySkills(canvasData: CanvasData): string[] {
    // TODO: Mocked for now. Implement more intelligent skill extraction.

    const skills: string[] = [];
    const nodeTypes = canvasData.nodes?.map((n) => n.type) || [];

    // 基于节点类型识别技能
    if (nodeTypes.includes('llm') || nodeTypes.includes('gpt')) {
      skills.push('AI对话');
    }

    if (nodeTypes.includes('embedding') || nodeTypes.includes('vector')) {
      skills.push('向量检索');
    }

    if (nodeTypes.includes('document') || nodeTypes.includes('pdf')) {
      skills.push('文档处理');
    }

    if (nodeTypes.includes('image') || nodeTypes.includes('vision')) {
      skills.push('图像识别');
    }

    if (nodeTypes.includes('api') || nodeTypes.includes('http')) {
      skills.push('API调用');
    }

    if (nodeTypes.includes('database') || nodeTypes.includes('sql')) {
      skills.push('数据查询');
    }

    if (nodeTypes.includes('email') || nodeTypes.includes('notification')) {
      skills.push('消息通知');
    }

    if (nodeTypes.includes('workflow') || nodeTypes.includes('condition')) {
      skills.push('流程控制');
    }

    // 如果没有识别到具体技能，返回通用技能
    if (skills.length === 0) {
      skills.push('内容生成');
      skills.push('信息处理');
    }

    return skills;
  }

  private async getLastExtractionTime(canvasId: string): Promise<Date | undefined> {
    try {
      const lastRecord = await this.prisma.variableExtractionHistory.findFirst({
        where: {
          canvasId,
          status: 'applied',
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      });

      return lastRecord?.createdAt;
    } catch (error) {
      this.logger.error(`Error getting last extraction time for canvas ${canvasId}:`, error);
      return undefined;
    }
  }

  private async getRecentVariablePatterns(canvasId: string): Promise<string[]> {
    try {
      const recentRecords = await this.prisma.variableExtractionHistory.findMany({
        where: {
          canvasId,
          status: 'applied',
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        select: {
          extractedVariables: true,
        },
      });

      const patterns = new Set<string>();

      for (const record of recentRecords) {
        try {
          const variables = JSON.parse(record.extractedVariables) as WorkflowVariable[];
          for (const variable of variables) {
            if (variable.description) {
              patterns.add(variable.description);
            }
            patterns.add(variable.name);
          }
        } catch {
          // 忽略解析错误的记录
        }
      }

      return Array.from(patterns).slice(0, 10);
    } catch (error) {
      this.logger.error(`Error getting recent variable patterns for canvas ${canvasId}:`, error);
      // 返回默认模式
      return ['项目名称', '目标用户', '功能范围', '时间要求', '质量标准'];
    }
  }

  private async getUserWorkflowPreferences(_uid: string): Promise<UserWorkflowPreferences> {
    // TODO: Mocked for now. Implement actual database query for user workflow preferences.

    // 模拟从数据库查询
    await new Promise((resolve) => setTimeout(resolve, 10));

    // 返回模拟的用户偏好
    return {
      preferredVariableTypes: ['string', 'option', 'resource'],
      commonWorkflowPatterns: ['内容生成', '数据分析', '文档处理', 'API集成'],
      extractionHistory: [
        {
          timestamp: new Date(Date.now() - 3600000),
          prompt: '帮我创建一个项目计划',
          extractedVariables: ['project_name', 'time_requirement', 'quality_standard'],
          confidence: 0.92,
        },
        {
          timestamp: new Date(Date.now() - 7200000),
          prompt: '生成一份技术报告',
          extractedVariables: ['report_topic', 'target_audience', 'technical_depth'],
          confidence: 0.88,
        },
      ],
    };
  }

  private async calculateSemanticSimilarity(
    _prompt: string,
    _variableText: string,
  ): Promise<number> {
    // TODO: Mocked for now. Implement using an embedding model for true semantic similarity.

    // 模拟异步计算
    await new Promise((resolve) => setTimeout(resolve, 20));

    // 简单的关键词匹配评分
    const promptWords = _prompt.toLowerCase().split(/\s+/);
    const variableWords = _variableText.toLowerCase().split(/\s+/);

    let matchCount = 0;
    for (const promptWord of promptWords) {
      for (const variableWord of variableWords) {
        if (promptWord.includes(variableWord) || variableWord.includes(promptWord)) {
          matchCount++;
        }
      }
    }

    // 计算相似度分数 (0-1)
    const similarity = Math.min(1, matchCount / Math.max(promptWords.length, variableWords.length));

    // 添加一些随机性模拟真实情况
    return Math.min(1, similarity + (Math.random() - 0.5) * 0.2);
  }

  private analyzeContextualRelevance(
    _variable: WorkflowVariable,
    _workflowType: string,
    _primarySkills: string[],
  ): number {
    // TODO: Mocked for now. Implement more complex contextual relevance analysis.

    let relevanceScore = 0.5; // 基础分数

    // 基于工作流类型调整相关性
    if (_workflowType.includes('文档') && _variable.variableType === 'string') {
      relevanceScore += 0.2;
    }

    if (_workflowType.includes('数据') && _variable.variableType === 'resource') {
      relevanceScore += 0.2;
    }

    if (_workflowType.includes('API') && _variable.variableType === 'option') {
      relevanceScore += 0.15;
    }

    // 基于技能类型调整相关性
    if (
      _primarySkills.some((skill) => skill.includes('AI')) &&
      _variable.description?.includes('主题')
    ) {
      relevanceScore += 0.1;
    }

    if (
      _primarySkills.some((skill) => skill.includes('处理')) &&
      _variable.description?.includes('内容')
    ) {
      relevanceScore += 0.1;
    }

    // 添加一些随机性模拟真实情况
    relevanceScore += (Math.random() - 0.5) * 0.1;

    return Math.max(0, Math.min(1, relevanceScore));
  }

  private detectReferencePatterns(_prompt: string, _variable: WorkflowVariable): number {
    // TODO: Mocked for now. Implement more intelligent anaphora/reference detection.

    const prompt = _prompt.toLowerCase();
    const variableName = _variable.name.toLowerCase();
    const variableDescription = _variable.description?.toLowerCase() || '';

    let referenceScore = 0;

    // 检测常见的指代词
    const referencePatterns = [
      '这个',
      '那个',
      '刚才的',
      '上面的',
      '下面的',
      '之前提到的',
      '前面说的',
      '后面要用的',
      '它',
      '它们',
      '这个项目',
      '那个功能',
    ];

    // 检查是否包含指代词
    for (const pattern of referencePatterns) {
      if (prompt.includes(pattern)) {
        referenceScore += 0.3;
        break;
      }
    }

    // 检查是否包含变量名或描述的变体
    if (prompt.includes(variableName) || prompt.includes(variableDescription)) {
      referenceScore += 0.4;
    }

    // 检查是否包含相关的同义词
    const synonyms: { [key: string]: string[] } = {
      项目: ['project', 'program', 'initiative'],
      用户: ['user', 'audience', 'customer', 'client'],
      功能: ['feature', 'function', 'capability'],
      内容: ['content', 'material', 'information'],
      时间: ['time', 'duration', 'period', 'deadline'],
    };

    for (const [chinese, english] of Object.entries(synonyms)) {
      if (variableDescription.includes(chinese) || variableDescription.includes(english[0])) {
        if (prompt.includes(chinese) || english.some((word) => prompt.includes(word))) {
          referenceScore += 0.2;
          break;
        }
      }
    }

    return Math.min(1, referenceScore);
  }

  private extractReferencedText(_prompt: string, _variable: WorkflowVariable): string {
    // TODO: Mocked for now. Implement more intelligent extraction of referenced text.

    const prompt = _prompt;
    const variableName = _variable.name;
    const variableDescription = _variable.description || '';

    // 尝试从prompt中提取包含变量名或描述的文本片段
    const words = prompt.split(/\s+/);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // 检查是否包含变量名
      if (word.toLowerCase().includes(variableName.toLowerCase())) {
        // 返回包含该词的上下文（前后各2个词）
        const start = Math.max(0, i - 2);
        const end = Math.min(words.length, i + 3);
        return words.slice(start, end).join(' ');
      }

      // 检查是否包含变量描述
      if (variableDescription && word.toLowerCase().includes(variableDescription.toLowerCase())) {
        const start = Math.max(0, i - 2);
        const end = Math.min(words.length, i + 3);
        return words.slice(start, end).join(' ');
      }
    }

    // 如果没有找到具体匹配，返回包含变量名的相关文本
    const sentences = prompt.split(/[。！？；]/);
    for (const sentence of sentences) {
      if (
        sentence.toLowerCase().includes(variableName.toLowerCase()) ||
        (variableDescription && sentence.toLowerCase().includes(variableDescription.toLowerCase()))
      ) {
        return sentence.trim();
      }
    }

    // 最后的后备方案
    return `包含"${variableName}"的相关内容`;
  }

  private generateReuseReason(
    _semanticScore: number,
    _contextualScore: number,
    _referenceScore: number,
  ): string {
    // TODO: Mocked for now. Implement more intelligent reuse reason generation.

    const reasons: string[] = [];

    // 基于语义相似度生成原因
    if (_semanticScore > 0.8) {
      reasons.push('语义高度相似');
    } else if (_semanticScore > 0.6) {
      reasons.push('语义较为相似');
    } else if (_semanticScore > 0.4) {
      reasons.push('语义部分相似');
    }

    // 基于上下文相关性生成原因
    if (_contextualScore > 0.8) {
      reasons.push('上下文高度相关');
    } else if (_contextualScore > 0.6) {
      reasons.push('上下文较为相关');
    }

    // 基于指代模式生成原因
    if (_referenceScore > 0.7) {
      reasons.push('检测到明确的指代关系');
    } else if (_referenceScore > 0.5) {
      reasons.push('存在潜在的指代关系');
    }

    // 如果没有具体原因，生成通用原因
    if (reasons.length === 0) {
      const totalScore = (_semanticScore + _contextualScore + _referenceScore) / 3;
      if (totalScore > 0.7) {
        reasons.push('综合评分较高，建议复用');
      } else if (totalScore > 0.5) {
        reasons.push('综合评分中等，可考虑复用');
      } else {
        reasons.push('基于多维度分析建议复用');
      }
    }

    return reasons.join('，');
  }

  /**
   * 获取Canvas工作流数据
   */
  private async getCanvasWorkflowData(user: User, canvasId: string): Promise<CanvasData> {
    try {
      // 这里应该调用CanvasService获取工作流数据
      // 由于CanvasService可能没有直接的工作流数据接口，我们先返回基础结构
      const contentItems = await this.canvasService.getCanvasContentItems(user, canvasId, false);

      // 从内容项构建节点信息
      const nodes = contentItems.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
      }));

      return {
        nodes,
        edges: [], // 需要从Canvas服务获取连接信息
        workflow: {
          variables: [], // 将在getCanvasVariables中获取
        },
      };
    } catch (error) {
      this.logger.error(`Error getting canvas workflow data for ${canvasId}:`, error);
      return {
        nodes: [],
        edges: [],
        workflow: { variables: [] },
      };
    }
  }

  /**
   * 获取Canvas现有变量
   */
  private async getCanvasVariables(user: User, canvasId: string): Promise<WorkflowVariable[]> {
    try {
      // Get workflow variables from Canvas service
      const variables = await this.canvasSyncService.getWorkflowVariables(user, {
        canvasId,
      });

      this.logger.log(`Retrieved ${variables.length} canvas variables for canvas ${canvasId}`);
      return variables;
    } catch (error) {
      this.logger.error(`Error getting canvas variables for ${canvasId}:`, error);
      return [];
    }
  }

  /**
   * 计算提取结果的总体置信度
   */
  private calculateOverallConfidence(result: VariableExtractionResult): number {
    if (!result.variables.length) {
      return 0;
    }

    // 基于变量数量和复杂度计算基础置信度
    const baseConfidence = Math.min(0.9, 0.5 + result.variables.length * 0.1);

    // 如果有处理后的提示词，增加置信度
    const hasProcessedPrompt = result.processedPrompt !== result.originalPrompt;
    const processedPromptBonus = hasProcessedPrompt ? 0.1 : 0;

    // 如果有复用变量，增加置信度
    const reuseBonus = result.reusedVariables.length > 0 ? 0.05 : 0;

    return Math.min(1, baseConfidence + processedPromptBonus + reuseBonus);
  }
}
