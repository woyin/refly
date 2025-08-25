import { Injectable, Logger } from '@nestjs/common';
import { User } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas/canvas-sync.service';
import { ProviderService } from '../provider/provider.service';
import { genVariableExtractionSessionID } from '@refly/utils';
import {
  buildVariableExtractionPrompt,
  buildValidationPrompt,
  buildHistoricalPrompt,
  buildConsensusPrompt,
} from './prompt';
import {
  ExtractionContext,
  VariableExtractionResult,
  WorkflowVariable,
  CandidateRecord,
  CanvasData,
  CanvasContext,
  VariableExtractionOptions,
  HistoricalData,
} from 'src/modules/variable-extraction/variable-extraction.dto';
import {
  addTimestampsToNewVariable,
  updateTimestampForVariable,
  hasVariableChanged,
} from './utils';

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
   * 核心变量提取方法（集成简化门控机制）
   *
   * 使用场景:
   * - direct模式: 直接更新Canvas变量，适用于用户确认的变量提取
   * - candidate模式: 返回候选方案，适用于需要用户确认的场景
   *
   * 作用: 根据用户输入和画布上下文，智能提取工作流变量，支持双路径验证和降级策略
   */
  async extractVariables(
    user: User,
    prompt: string,
    canvasId: string,
    options: VariableExtractionOptions = {},
  ): Promise<VariableExtractionResult> {
    const { mode = 'direct', sessionId, triggerType = 'askAI_direct' } = options;

    // 1. 检查候选记录（有sessionId时，无论模式）
    if (mode === 'direct' && sessionId) {
      const candidateRecord = await this.getCandidateRecord(sessionId);
      if (candidateRecord && !candidateRecord.applied) {
        return this.applyCandidateRecord(user, canvasId, candidateRecord);
      }
    }

    // 2. 构建上下文（多维度分析）
    const context = await this.buildEnhancedContext(canvasId, user);

    let extractionResult: VariableExtractionResult;

    // 3. 根据门控决策执行相应模式
    if (mode === 'direct') {
      // 增强直接模式：使用双路径验证
      extractionResult = await this.performEnhancedDirectExtraction(
        prompt,
        context,
        user,
        canvasId,
      );
    } else {
      // 候选模式：使用原有的完整实现
      extractionResult = await this.performCandidateModeExtraction(
        prompt,
        context,
        user,
        canvasId,
        sessionId,
      );
    }

    // 获取模型名称用于记录
    const model = await this.prepareChatModel(user);
    const modelName = model?.constructor?.name || 'unknown';

    // 4. 根据模式处理结果（统一处理存储逻辑）
    if (mode === 'direct') {
      await this.updateCanvasVariables(user, canvasId, extractionResult.variables);

      // 使用通用保存函数
      await this.saveExtractionRecord(user, canvasId, extractionResult, {
        mode: 'direct',
        triggerType,
        model: modelName,
        status: 'applied',
      });
    } else {
      // 候选模式：使用通用保存函数
      const finalSessionId = await this.saveExtractionRecord(user, canvasId, extractionResult, {
        mode: 'candidate',
        triggerType,
        model: modelName,
        status: 'pending',
      });
      extractionResult.sessionId = finalSessionId;
    }

    return extractionResult;
  }

  /**
   * 增强直接模式：双路径验证处理
   *
   * 使用场景: 直接模式下的高质量变量提取，需要双重验证保证准确性
   *
   * 作用:
   * - 并行执行主路径和验证路径的LLM提取
   * - 生成共识结果并进行质量检查
   * - 质量不达标时自动降级到候选模式
   */
  private async performEnhancedDirectExtraction(
    prompt: string,
    context: ExtractionContext,
    user: User,
    canvasId: string,
  ): Promise<VariableExtractionResult> {
    try {
      this.logger.log('Performing enhanced direct mode extraction with dual-path validation');

      // 1. 并行双路径处理
      const [primaryResult, validationResult] = await Promise.all([
        this.performLLMExtraction(prompt, context, user),
        this.performValidationLLMExtraction(prompt, context, user),
      ]);

      // 2. 生成共识结果
      const consensusResult = await this.generateConsensusResult(
        primaryResult,
        validationResult,
        user,
      );

      // 3. 基础质量检查
      const qualityScore = await this.performBasicQualityCheck(consensusResult, context);

      if (qualityScore >= 0.8) {
        this.logger.log('Enhanced direct mode quality check passed');
        return consensusResult;
      } else {
        this.logger.warn(
          `Enhanced direct mode quality below threshold: ${qualityScore}, falling back to candidate mode`,
        );
        // 降级到候选模式
        return await this.performCandidateModeExtraction(
          prompt,
          context,
          user,
          canvasId,
          undefined,
        );
      }
    } catch (error) {
      this.logger.error(
        `Enhanced direct mode failed: ${error.message}, falling back to candidate mode`,
      );
      // 降级到候选模式
      return await this.performCandidateModeExtraction(prompt, context, user, canvasId, undefined);
    }
  }

  /**
   * 候选模式：使用原有的完整实现
   *
   * 使用场景: 需要用户确认的变量提取，或者作为直接模式的降级策略
   *
   * 作用:
   * - 获取完整的历史数据进行分析
   * - 构建增强的历史学习提示词
   * - 执行多轮LLM处理提升质量
   * - 不负责存储，只负责抽取逻辑
   */
  private async performCandidateModeExtraction(
    prompt: string,
    context: ExtractionContext,
    user: User,
    canvasId: string,
    sessionId?: string,
  ): Promise<VariableExtractionResult> {
    this.logger.log('Performing candidate mode extraction with full features');

    // 1. 获取完整的历史数据
    const historicalData = await this.getComprehensiveHistoricalData(user.uid, canvasId);

    // 2. 构建增强提示词
    const enhancedPrompt = this.buildAdvancedHistoryPrompt(prompt, context, historicalData);

    // 3. 执行多轮LLM处理
    const extractionResult = await this.performMultiRoundLLMExtraction(
      enhancedPrompt,
      context,
      user,
      prompt,
    );

    // 4. 不在这里保存候选记录，由调用方统一处理存储逻辑
    // 只设置 sessionId 如果传入的话
    if (sessionId) {
      extractionResult.sessionId = sessionId;
    }

    return extractionResult;
  }

  private async prepareChatModel(user: User) {
    const chatPi = await this.providerService.findDefaultProviderItem(user, 'chat');
    if (!chatPi || chatPi.category !== 'llm' || !chatPi.enabled) {
      throw new Error('No valid LLM provider found for validation');
    }

    const model = await this.providerService.prepareChatModel(user, chatPi.itemId);

    return model;
  }

  /**
   * 验证LLM提取（用于增强直接模式的双路径验证）
   *
   * 使用场景: 增强直接模式下的验证路径，提供第二意见验证主路径结果
   *
   * 作用:
   * - 使用验证导向的提示词进行变量提取
   * - 重点关注变量的准确性和合理性
   * - 为主路径结果提供验证和补充
   */
  private async performValidationLLMExtraction(
    prompt: string,
    context: ExtractionContext,
    user: User,
  ): Promise<VariableExtractionResult> {
    try {
      // 使用验证模式的提示词
      const validationPrompt = buildValidationPrompt(prompt, context.variables, {
        nodeCount: context.analysis.nodeCount,
        complexity: context.analysis.complexity,
        resourceCount: context.analysis.resourceCount,
        lastExtractionTime: context.extractionContext.lastExtractionTime,
        recentVariablePatterns: context.extractionContext.recentVariablePatterns,
        workflowType: context.analysis.workflowType,
        primarySkills: context.analysis.primarySkills,
      } as CanvasContext);

      const model = await this.prepareChatModel(user);
      const response = await model.invoke(validationPrompt);
      const responseText = response.content.toString();

      return this.parseLLMResponse(responseText, prompt);
    } catch (error) {
      this.logger.error(`Validation LLM extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成共识结果（用于增强直接模式）
   */
  private async generateConsensusResult(
    primaryResult: VariableExtractionResult,
    validationResult: VariableExtractionResult,
    user: User,
  ): Promise<VariableExtractionResult> {
    try {
      // 使用共识生成提示词
      const consensusPrompt = buildConsensusPrompt(primaryResult, validationResult);

      const model = await this.prepareChatModel(user);
      const response = await model.invoke(consensusPrompt);
      const responseText = response.content.toString();

      try {
        const consensusData = JSON.parse(responseText);
        if (consensusData.variables && Array.isArray(consensusData.variables)) {
          return {
            ...primaryResult,
            variables: consensusData.variables,
            reusedVariables: consensusData.reusedVariables || primaryResult.reusedVariables,
          };
        }
      } catch (parseError) {
        this.logger.warn(
          `Failed to parse consensus LLM response, using primary result: ${parseError}`,
        );
      }

      // 如果LLM共识生成失败，使用智能合并逻辑
      return this.mergeResultsIntelligently(primaryResult, validationResult);
    } catch (error) {
      this.logger.error(`Consensus generation failed: ${error.message}`);
      // 返回智能合并结果作为后备
      return this.mergeResultsIntelligently(primaryResult, validationResult);
    }
  }

  /**
   * 智能合并两个提取结果
   */
  private mergeResultsIntelligently(
    primaryResult: VariableExtractionResult,
    validationResult: VariableExtractionResult,
  ): VariableExtractionResult {
    const mergedVariables = [...primaryResult.variables];
    const mergedReusedVariables = [...primaryResult.reusedVariables];

    // 合并验证结果中的新变量
    for (const validationVar of validationResult.variables) {
      const existingIndex = mergedVariables.findIndex((v) => v.name === validationVar.name);
      if (existingIndex >= 0) {
        // 如果变量已存在，选择质量更高的版本
        const existingVar = mergedVariables[existingIndex];
        if (
          this.calculateVariableQuality(validationVar) > this.calculateVariableQuality(existingVar)
        ) {
          mergedVariables[existingIndex] = validationVar;
        }
      } else {
        // 添加新变量
        mergedVariables.push(validationVar);
      }
    }

    // 合并复用变量
    for (const reuseVar of validationResult.reusedVariables) {
      const existingIndex = mergedReusedVariables.findIndex(
        (v) => v.reusedVariableName === reuseVar.reusedVariableName,
      );
      if (existingIndex < 0) {
        mergedReusedVariables.push(reuseVar);
      }
    }

    return {
      ...primaryResult,
      variables: mergedVariables,
      reusedVariables: mergedReusedVariables,
    };
  }

  /**
   * 计算变量质量分数
   */
  private calculateVariableQuality(variable: WorkflowVariable): number {
    let score = 0;

    // 基于变量名称质量
    if (variable.name && variable.name.length > 0) score += 0.3;

    // 基于描述质量
    if (variable.description && variable.description.length > 10) score += 0.3;

    // 基于变量类型
    if (variable.variableType) score += 0.2;

    // 基于值的存在性
    if (variable.value && Array.isArray(variable.value) && variable.value.length > 0) score += 0.2;

    return score;
  }

  /**
   * 基础质量检查（用于增强直接模式）
   */
  private async performBasicQualityCheck(
    result: VariableExtractionResult,
    context: ExtractionContext,
  ): Promise<number> {
    try {
      // 1. 语法验证
      const syntaxValid = this.validateSyntax(result);

      // 2. 上下文相关性检查
      const contextRelevant = this.checkContextRelevance(result, context);

      // 3. 变量完整性检查
      const variableCompleteness = this.checkVariableCompleteness(result);

      // 4. 计算总体评分
      const overallScore = this.calculateOverallScore(
        syntaxValid,
        contextRelevant,
        variableCompleteness,
      );

      return overallScore;
    } catch (error) {
      this.logger.error(`Basic quality check failed: ${error.message}`);
      return 0.5; // 返回中等评分作为后备
    }
  }

  /**
   * 语法验证
   */
  private validateSyntax(result: VariableExtractionResult): boolean {
    return result.variables.every(
      (v) => v.name && v.name.length > 0 && v.variableType && Array.isArray(v.value),
    );
  }

  /**
   * 上下文相关性检查
   */
  private checkContextRelevance(
    result: VariableExtractionResult,
    context: ExtractionContext,
  ): boolean {
    // 如果没有现有变量，认为相关
    if (context.variables.length === 0) {
      return true;
    }

    // 检查提取的变量是否与现有变量有重叠
    const existingNames = new Set(context.variables.map((v) => v.name));
    const extractedNames = new Set(result.variables.map((v) => v.name));

    const overlap = Array.from(existingNames).filter((name) => extractedNames.has(name));
    return overlap.length > 0 || result.variables.length > 0;
  }

  /**
   * 变量完整性检查
   */
  private checkVariableCompleteness(result: VariableExtractionResult): boolean {
    if (result.variables.length === 0) return false;

    // 检查每个变量是否有必要的字段
    const completeVariables = result.variables.filter(
      (v) => v.name && v.variableType && v.description,
    );

    return completeVariables.length / result.variables.length >= 0.8;
  }

  /**
   * 计算总体评分
   */
  private calculateOverallScore(
    syntaxValid: boolean,
    contextRelevant: boolean,
    variableCompleteness: boolean,
  ): number {
    let score = 0;

    if (syntaxValid) score += 0.4;
    if (contextRelevant) score += 0.3;
    if (variableCompleteness) score += 0.3;

    return score;
  }

  /**
   * 获取完整的历史数据（用于候选模式）
   */
  private async getComprehensiveHistoricalData(
    uid: string,
    canvasId: string,
  ): Promise<HistoricalData> {
    try {
      const [extractionHistory, canvasPatterns] = await Promise.all([
        this.prisma.variableExtractionHistory.findMany({
          where: { uid, status: 'applied' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        this.getRecentVariablePatterns(canvasId),
      ]);

      return {
        extractionHistory,
        canvasPatterns,
      };
    } catch (error) {
      this.logger.error(`Failed to get comprehensive historical data: ${error.message}`);
      // 返回空数据作为后备
      return {
        extractionHistory: [],
        canvasPatterns: [],
      };
    }
  }

  /**
   * 构建高级历史提示词（用于候选模式）
   */
  private buildAdvancedHistoryPrompt(
    prompt: string,
    context: ExtractionContext,
    historicalData: HistoricalData,
  ): string {
    return buildHistoricalPrompt(
      prompt,
      context.variables,
      {
        nodeCount: context.analysis.nodeCount,
        complexity: context.analysis.complexity,
        resourceCount: context.analysis.resourceCount,
        lastExtractionTime: context.extractionContext.lastExtractionTime,
        recentVariablePatterns: context.extractionContext.recentVariablePatterns,
        workflowType: context.analysis.workflowType,
        primarySkills: context.analysis.primarySkills,
      } as CanvasContext,
      historicalData,
    );
  }

  /**
   * 执行多轮LLM处理（用于候选模式）
   */
  private async performMultiRoundLLMExtraction(
    enhancedPrompt: string,
    context: ExtractionContext,
    user: User,
    prompt: string,
  ): Promise<VariableExtractionResult> {
    try {
      // 使用增强的提示词进行LLM提取

      const model = await this.prepareChatModel(user);
      const response = await model.invoke(enhancedPrompt);
      const responseText = response.content.toString();

      return this.parseLLMResponse(responseText, prompt);
    } catch (error) {
      this.logger.error(`Multi-round LLM extraction failed: ${error.message}`);
      // 降级到基础提取
      return this.performLLMExtraction(enhancedPrompt, context, user);
    }
  }

  /**
   * 构建上下文 - 多维度Canvas分析
   *
   * 使用场景: 变量提取前的上下文准备，需要分析画布状态和历史信息
   *
   * 作用:
   * - 获取Canvas数据和内容项
   * - 分析工作流复杂度和特征
   * - 检测工作流类型和主要技能
   * - 构建完整的提取上下文信息
   */
  public async buildEnhancedContext(canvasId: string, user: User): Promise<ExtractionContext> {
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

        // 基础统计信息
        nodeCount: canvasData.nodes?.length || 0,
        variableCount: variables.length,
        resourceCount: contentItems.filter((item) => item.type === 'resource').length,

        // 工作流类型和技能分析
        workflowType: this.detectWorkflowType(contentItems, variables),
        primarySkills: this.detectPrimarySkills(contentItems, variables),
      };

      this.logger.log(
        `Built context for canvas ${canvasId}: ${analysis.nodeCount} nodes, ${analysis.variableCount} variables`,
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
          nodeCount: 0,
          variableCount: 0,
          resourceCount: 0,
          workflowType: '通用工作流',
          primarySkills: ['内容生成'],
        },
        extractionContext: {
          lastExtractionTime: undefined,
          recentVariablePatterns: [],
        },
      };
    }
  }

  private async getCandidateRecord(sessionId: string): Promise<CandidateRecord | null> {
    try {
      const record = await this.prisma.variableExtractionHistory.findUnique({
        where: {
          sessionId,
          status: 'pending',
          extractionMode: 'candidate',
        },
      });

      if (!record) {
        return null;
      }

      return {
        sessionId: record.sessionId!,
        canvasId: record.canvasId,
        uid: record.uid,
        originalPrompt: record.originalPrompt,
        extractedVariables: JSON.parse(record.extractedVariables),
        reusedVariables: JSON.parse(record.reusedVariables),
        applied: record.status === 'applied',
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
        originalPrompt: record.originalPrompt, // 使用候选记录的原始提示词
        processedPrompt: this.generateProcessedPrompt(
          record.originalPrompt,
          record.extractedVariables,
        ),
        variables: record.extractedVariables,
        reusedVariables: record.reusedVariables,
        sessionId: record.sessionId, // 保持会话ID
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

  /**
   * 执行LLM变量提取
   *
   * 使用场景: 核心的变量提取逻辑，需要调用LLM进行智能分析
   *
   * 作用:
   * - 获取LLM模型实例
   * - 构建增强的变量提取提示词
   * - 调用LLM进行变量提取
   * - 解析和验证LLM响应
   */
  public async performLLMExtraction(
    originalPrompt: string,
    context: ExtractionContext,
    user: User,
  ): Promise<VariableExtractionResult> {
    try {
      // 1. 获取LLM模型实例（参考pilot.service.ts的模式）
      const model = await this.prepareChatModel(user);

      // 2. 构建变量提取提示词（使用增强版本）
      const extractionPrompt = buildVariableExtractionPrompt(originalPrompt, context.variables, {
        nodeCount: context.analysis.nodeCount,
        complexity: context.analysis.complexity,
        resourceCount: context.analysis.resourceCount,
        lastExtractionTime: context.extractionContext.lastExtractionTime,
        recentVariablePatterns: context.extractionContext.recentVariablePatterns,
        workflowType: context.analysis.workflowType,
        primarySkills: context.analysis.primarySkills,
      } as CanvasContext);

      this.logger.log(
        `Performing LLM extraction for prompt: "${originalPrompt.substring(0, 100)}..."`,
      );

      // 3. 调用LLM进行变量提取
      const response = await model.invoke(extractionPrompt);
      const responseText = response.content.toString();

      // 4. 解析LLM响应
      const extractionResult = this.parseLLMResponse(responseText, originalPrompt);

      this.logger.log(
        `LLM extraction completed with ${extractionResult.variables.length} variables`,
      );

      return extractionResult;
    } catch (error) {
      this.logger.error(`Error in LLM extraction: ${error.message}`);

      // 降级到基础提取，确保服务可用性
      this.logger.warn('Falling back to basic extraction due to LLM failure');
      return {
        originalPrompt,
        processedPrompt: originalPrompt,
        variables: [],
        reusedVariables: [],
      };
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

      // Merge new variables with existing ones, properly handling timestamps
      const mergedVariables = [...(currentVariables || [])];
      let hasChanges = false;

      for (const newVariable of variables) {
        const existingIndex = mergedVariables.findIndex((v) => v.name === newVariable.name);

        if (existingIndex >= 0) {
          // Found existing variable - check if it actually changed
          const existingVariable = mergedVariables[existingIndex];

          if (hasVariableChanged(newVariable, existingVariable)) {
            // Variable has meaningful changes - update with new timestamp
            mergedVariables[existingIndex] = updateTimestampForVariable(
              newVariable,
              existingVariable,
            );
            hasChanges = true;
            this.logger.debug(`Updated existing variable: ${newVariable.name}`);
          } else {
            // No meaningful changes - keep existing variable with original timestamps
            this.logger.debug(`No changes detected for variable: ${newVariable.name}`);
          }
        } else {
          // New variable - add with creation timestamp
          const newVariableWithTimestamp = addTimestampsToNewVariable(newVariable);
          mergedVariables.push(newVariableWithTimestamp);
          hasChanges = true;
          this.logger.debug(`Added new variable: ${newVariable.name}`);
        }
      }

      // Only update if there are actual changes
      if (hasChanges) {
        // Use CanvasSyncService to update workflow variables in canvas
        await this.canvasSyncService.updateWorkflowVariables(user, {
          canvasId,
          variables: mergedVariables,
        });
        this.logger.log(`Canvas variables updated successfully for canvas ${canvasId}`);
      } else {
        this.logger.log(`No variable changes detected for canvas ${canvasId}, skipping update`);
      }
    } catch (error) {
      this.logger.error(`Failed to update canvas variables for ${canvasId}: ${error.message}`);
      throw new Error(`Failed to update canvas variables: ${error.message}`);
    }
  }

  /**
   * 统一的变量提取记录保存方法
   *
   * 使用场景: 统一处理候选记录和直接模式的历史记录保存
   *
   * 作用:
   * - 避免代码重复
   * - 统一错误处理
   * - 提供一致的日志记录
   */
  private async saveExtractionRecord(
    user: User,
    canvasId: string,
    result: VariableExtractionResult,
    options: {
      mode: 'candidate' | 'direct';
      triggerType: string;
      model?: string;
      status: 'pending' | 'applied';
    },
  ): Promise<string | undefined> {
    try {
      const sessionId =
        options.mode === 'candidate' ? genVariableExtractionSessionID() : result.sessionId;

      const recordData = {
        sessionId: options.mode === 'candidate' ? sessionId : result.sessionId || null,
        canvasId,
        uid: user.uid,
        triggerType: options.triggerType,
        extractionMode: options.mode,
        originalPrompt: result.originalPrompt,
        processedPrompt: result.processedPrompt,
        extractedVariables: JSON.stringify(result.variables),
        reusedVariables: JSON.stringify(result.reusedVariables),
        extractionConfidence: this.calculateOverallConfidence(result),
        llmModel: options.model || null,
        status: options.status,
        ...(options.status === 'applied' && { appliedAt: new Date() }),
      };

      await this.prisma.variableExtractionHistory.create({
        data: recordData,
      });

      const logMessage =
        options.mode === 'candidate'
          ? `Saved candidate record ${sessionId} for canvas ${canvasId}`
          : `Saved extraction history for canvas ${canvasId}, mode: ${options.mode}`;

      this.logger.log(logMessage);

      // 候选模式返回 sessionId，直接模式返回 undefined
      return options.mode === 'candidate' ? sessionId : undefined;
    } catch (error) {
      const errorMessage = `Error saving ${options.mode} record for canvas ${canvasId}: ${error.message}`;
      this.logger.error(errorMessage);

      throw new Error(`Failed to save candidate record: ${error.message}`);
    }
  }

  private calculateComplexityScore(canvasData: CanvasData): number {
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
   * 基于LLM返回的置信度分数进行加权计算，提供更可信的评估
   */
  private calculateOverallConfidence(result: VariableExtractionResult): number {
    if (!result.variables.length) {
      return 0;
    }

    // 1. 基于LLM返回的变量置信度计算基础分数
    const variableConfidences = result.variables
      .map((v) => (v as any).confidence || 0.8) // 如果没有置信度，默认为0.8
      .filter((conf) => conf > 0); // 过滤掉无效置信度

    if (variableConfidences.length === 0) {
      return 0.5; // 如果没有有效置信度，返回中等评分
    }

    // 2. 计算加权平均置信度（变量数量越多，权重越高）
    const totalConfidence = variableConfidences.reduce((sum, conf) => sum + conf, 0);
    const baseConfidence = totalConfidence / variableConfidences.length;

    // 3. 基于变量数量调整置信度（变量越多，置信度可能越低）
    const variableCountAdjustment = Math.max(0.1, 1 - (result.variables.length - 1) * 0.05);

    // 4. 基于变量类型分布调整置信度
    const typeDistribution = this.calculateTypeDistributionConfidence(result.variables);

    // 5. 基于复用变量调整置信度
    const reuseAdjustment = result.reusedVariables.length > 0 ? 0.05 : 0;

    // 6. 基于处理后的提示词质量调整置信度
    const processedPromptQuality = this.assessProcessedPromptQuality(result);

    // 7. 综合计算最终置信度
    const finalConfidence = Math.min(
      1,
      baseConfidence * variableCountAdjustment * typeDistribution +
        reuseAdjustment +
        processedPromptQuality,
    );

    this.logger.debug(
      `Confidence calculation: base=${baseConfidence.toFixed(3)}, ` +
        `countAdj=${variableCountAdjustment.toFixed(3)}, ` +
        `typeDist=${typeDistribution.toFixed(3)}, ` +
        `reuse=${reuseAdjustment.toFixed(3)}, ` +
        `promptQuality=${processedPromptQuality.toFixed(3)}, ` +
        `final=${finalConfidence.toFixed(3)}`,
    );

    return finalConfidence;
  }

  /**
   * 计算变量类型分布的置信度调整因子
   */
  private calculateTypeDistributionConfidence(variables: WorkflowVariable[]): number {
    const typeCounts = new Map<string, number>();

    for (const variable of variables) {
      const type = variable.variableType || 'unknown';
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    }

    // 类型分布越均匀，置信度越高
    const totalVariables = variables.length;
    const typeDiversity = typeCounts.size / Math.min(totalVariables, 3); // 最多3种类型

    return 0.8 + typeDiversity * 0.2; // 0.8-1.0范围
  }

  /**
   * 评估处理后提示词的质量
   */
  private assessProcessedPromptQuality(result: VariableExtractionResult): number {
    if (result.processedPrompt === result.originalPrompt) {
      return 0; // 没有处理，不加分
    }

    // 检查占位符数量是否合理
    const placeholderCount = (result.processedPrompt.match(/\{\{[^}]+\}\}/g) || []).length;
    const variableCount = result.variables.length;

    if (placeholderCount === 0 || variableCount === 0) {
      return 0;
    }

    // 占位符数量应该与变量数量匹配
    const placeholderRatio =
      Math.min(placeholderCount, variableCount) / Math.max(placeholderCount, variableCount);

    // 检查占位符格式是否正确
    const validPlaceholders = (
      result.processedPrompt.match(/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/g) || []
    ).length;
    const formatQuality = validPlaceholders / placeholderCount;

    return Math.min(0.1, placeholderRatio * formatQuality * 0.1);
  }

  /**
   * 检测工作流类型
   */
  private detectWorkflowType(contentItems: any[], variables: WorkflowVariable[]): string {
    // 基于内容项类型检测工作流类型
    const itemTypes = contentItems.map((item) => item.type);

    if (itemTypes.includes('resource') && itemTypes.includes('text')) {
      return '内容生成工作流';
    } else if (
      itemTypes.includes('resource') &&
      variables.some((v) => v.variableType === 'resource')
    ) {
      return '文件处理工作流';
    } else if (variables.some((v) => v.variableType === 'option')) {
      return '配置选择工作流';
    } else {
      return '通用工作流';
    }
  }

  /**
   * 检测主要技能
   */
  private detectPrimarySkills(contentItems: any[], variables: WorkflowVariable[]): string[] {
    const skills = new Set<string>();

    // 基于内容项类型推断技能
    const itemTypes = contentItems.map((item) => item.type);

    if (itemTypes.includes('text')) {
      skills.add('内容生成');
    }
    if (itemTypes.includes('resource')) {
      skills.add('文件处理');
    }
    if (variables.some((v) => v.variableType === 'option')) {
      skills.add('配置管理');
    }
    if (variables.some((v) => v.variableType === 'string')) {
      skills.add('参数化处理');
    }

    return Array.from(skills).length > 0 ? Array.from(skills) : ['内容生成'];
  }
}
