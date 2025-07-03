import { MultimodalProvider, GenerationRequest, GenerationResponse } from '../types';

/**
 * 音频生成基础抽象类
 * 提供音频生成的通用接口和验证逻辑
 */
export abstract class BaseAudioGenerator {
  protected config: MultimodalProvider;

  constructor(config: MultimodalProvider) {
    this.config = config;
  }

  /**
   * 生成单个音频
   * @param request 生成请求参数
   * @returns 生成响应
   */
  abstract generate(request: GenerationRequest): Promise<GenerationResponse>;

  /**
   * 批量生成音频
   * @param requests 生成请求参数数组
   * @returns 生成响应数组
   */
  abstract generateBatch(requests: GenerationRequest[]): Promise<GenerationResponse[]>;

  /**
   * 验证生成请求参数
   * @param request 生成请求参数
   */
  protected validateRequest(request: GenerationRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error('Prompt is required for audio generation');
    }

    // 验证音频特定参数
    if (request.duration && (request.duration <= 0 || request.duration > 300)) {
      throw new Error('Duration must be between 0 and 300 seconds');
    }
  }
}

/**
 * 同步音频生成器基类
 * 用于实现同步API调用的音频生成服务
 */
export abstract class BaseSyncAudioGenerator extends BaseAudioGenerator {
  // 子类直接实现 generate 方法，调用具体的 API
}

/**
 * 异步音频生成器基类
 * 用于实现异步任务处理的音频生成服务
 */
export abstract class BaseAsyncAudioGenerator extends BaseAudioGenerator {
  /**
   * 提交异步音频生成任务
   * @param request 生成请求参数
   * @returns 任务ID
   */
  protected abstract submitTask(request: GenerationRequest): Promise<string>;

  /**
   * 检查异步任务状态
   * @param taskId 任务ID
   * @returns 任务状态信息
   */
  protected abstract checkTaskStatus(taskId: string): Promise<{
    status: 'pending' | 'processing' | 'succeeded' | 'failed';
    result?: any;
    error?: string;
  }>;

  /**
   * 轮询任务完成状态
   * @param taskId 任务ID
   * @returns 任务结果
   */
  protected async pollTaskCompletion(taskId: string): Promise<any> {
    const pollInterval = this.config.pollInterval || 5000;
    const maxAttempts = this.config.maxPollAttempts || 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.checkTaskStatus(taskId);

      if (status.status === 'succeeded') {
        return status.result;
      } else if (status.status === 'failed') {
        throw new Error(`Audio generation task failed: ${status.error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error(`Audio generation task ${taskId} timed out after ${maxAttempts} attempts`);
  }

  /**
   * 生成音频（异步实现）
   * @param request 生成请求参数
   * @returns 生成响应
   */
  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    this.validateRequest(request);

    const taskId = await this.submitTask(request);
    const result = await this.pollTaskCompletion(taskId);

    return this.transformOutput(result, request, taskId);
  }

  /**
   * 转换输出格式
   * @param result 原始结果
   * @param request 原始请求
   * @param taskId 任务ID
   * @returns 标准化的生成响应
   */
  protected abstract transformOutput(
    result: any,
    request: GenerationRequest,
    taskId: string,
  ): GenerationResponse;
}
